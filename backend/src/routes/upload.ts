import express from "express"
import fs from "node:fs/promises"
import multer from "multer"
import type { Request } from "express"
import { authenticate, type AuthRequest } from "../middleware/authMiddleware"
import { sendError, sendSuccess, handleServerError } from "../lib/api"
import { createAuditTrailEvent, toAuditTrailResponse } from "../lib/audit"
import { uploadToIPFS } from "../services/ipfs"
import { isNonEmptyString, isValidObjectId } from "../lib/validation"
import { InstituteModel } from "../models/Institute"
import { CertificateSubmissionModel } from "../models/CertificateSubmission"

const router = express.Router()
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
])

// temporary local storage
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new multer.MulterError("LIMIT_UNEXPECTED_FILE", "certificate")
      )
      return
    }

    callback(null, true)
  },
})

function runUploadMiddleware(req: Request, res: express.Response) {
  return new Promise<void>((resolve, reject) => {
    upload.single("certificate")(req, res, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    await runUploadMiddleware(req, res)
  } catch (error) {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return sendError(
          res,
          400,
          "FILE_TOO_LARGE",
          "Certificate files must be 10 MB or smaller"
        )
      }

      return sendError(
        res,
        400,
        "INVALID_FILE",
        "Certificate must be a PDF or image file"
      )
    }

    return handleServerError(res, error, "Could not process the uploaded file")
  }

  try {
    if (!req.user) {
      return sendError(res, 401, "UNAUTHORIZED", "You must be signed in")
    }

    const { courseName, instituteId } = req.body as {
      courseName?: string
      instituteId?: string
    }

    if (!req.file) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "A certificate file is required"
      )
    }

    if (!isNonEmptyString(courseName) || !isNonEmptyString(instituteId)) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Course name and institute are required",
        {
          ...(isNonEmptyString(courseName)
            ? {}
            : { courseName: "Course name is required" }),
          ...(isNonEmptyString(instituteId)
            ? {}
            : { instituteId: "Institute is required" }),
        }
      )
    }

    if (!isValidObjectId(instituteId)) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Institute id is invalid"
      )
    }

    const institute = await InstituteModel.findById(instituteId).lean()

    if (!institute || !institute.isActive) {
      return sendError(
        res,
        404,
        "INSTITUTE_NOT_FOUND",
        "The selected institute is not available"
      )
    }

    const uploadedFilePath = req.file.path
    const cid = await uploadToIPFS(uploadedFilePath)
    const submission = await CertificateSubmissionModel.create({
      studentAddress: req.user.address,
      courseName: courseName.trim(),
      instituteId: institute._id,
      instituteName: institute.name,
      cid,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      status: "pending_review",
      auditTrail: [
        createAuditTrailEvent({
          type: "submission_created",
          title: "Submission created",
          description:
            "Student uploaded the certificate and submitted it for review.",
          actorAddress: req.user.address,
          metadata: {
            cid,
            fileName: req.file.originalname,
            instituteName: institute.name,
          },
        }),
      ],
    })

    return sendSuccess(
      res,
      {
        submission: {
          id: submission.id,
          studentAddress: submission.studentAddress,
          courseName: submission.courseName,
          instituteId: String(submission.instituteId),
          instituteName: submission.instituteName,
          cid: submission.cid,
          fileName: submission.fileName,
          mimeType: submission.mimeType,
          status: submission.status,
          uploadedAt: submission.uploadedAt.toISOString(),
          ipfsUrl: `https://ipfs.io/ipfs/${submission.cid}`,
          auditTrail: (submission.auditTrail ?? []).map(toAuditTrailResponse),
        },
      },
      201
    )

  } catch (error) {
    return handleServerError(res, error, "IPFS upload failed")

  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => undefined)
    }
  }

})

export default router
