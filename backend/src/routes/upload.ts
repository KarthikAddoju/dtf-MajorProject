import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import type { Request } from "express";
import { authenticate, type AuthRequest } from "../middleware/authMiddleware";
import { sendError, sendSuccess, handleServerError } from "../lib/api";
import { createAuditTrailEvent } from "../lib/audit";
import {
  isCredentialType,
  isNonEmptyString,
  isValidObjectId,
} from "../lib/validation";
import { InstituteModel } from "../models/Institute";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";
import { buildInstituteHash } from "../lib/institutes";
import {
  loadEvidenceBuffer,
  storeEncryptedEvidenceBuffer,
} from "../services/evidenceVault";
import { toSubmissionResponse } from "../lib/submissionResponses";

const router = express.Router();
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new multer.MulterError("LIMIT_UNEXPECTED_FILE", "certificate")
      );
      return;
    }

    callback(null, true);
  },
});

function runUploadMiddleware(req: Request, res: express.Response) {
  return new Promise<void>((resolve, reject) => {
    upload.single("certificate")(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function isMongoDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    await runUploadMiddleware(req, res);
  } catch (error) {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return sendError(
          res,
          400,
          "FILE_TOO_LARGE",
          "Certificate files must be 10 MB or smaller"
        );
      }

      return sendError(
        res,
        400,
        "INVALID_FILE",
        "Credential evidence must be a PDF or image file"
      );
    }

    return handleServerError(res, error, "Could not process the uploaded file");
  }

  try {
    if (!req.user) {
      return sendError(res, 401, "UNAUTHORIZED", "You must be signed in");
    }

    const { courseName, credentialType, instituteId } = req.body as {
      courseName?: string;
      credentialType?: string;
      instituteId?: string;
    };

    if (!req.file) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "A credential evidence file is required"
      );
    }

    const MAX_COURSE_NAME_LENGTH = 500;
    if (
      isNonEmptyString(courseName) &&
      courseName.trim().length > MAX_COURSE_NAME_LENGTH
    ) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        `Credential title must be ${MAX_COURSE_NAME_LENGTH} characters or fewer`
      );
    }

    if (!isNonEmptyString(courseName) || !isNonEmptyString(instituteId)) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Credential title and institute are required",
        {
          ...(isNonEmptyString(courseName)
            ? {}
            : { courseName: "Credential title is required" }),
          ...(isNonEmptyString(instituteId)
            ? {}
            : { instituteId: "Institute is required" }),
        }
      );
    }

    const normalizedCredentialType = credentialType ?? "course";

    if (!isCredentialType(normalizedCredentialType)) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Credential type is invalid",
        {
          credentialType: "Select a valid credential type",
        }
      );
    }

    if (!isValidObjectId(instituteId)) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Institute id is invalid"
      );
    }

    const institute = await InstituteModel.findById(instituteId).lean();

    if (!institute || !institute.isActive) {
      return sendError(
        res,
        404,
        "INSTITUTE_NOT_FOUND",
        "The selected institute is not available"
      );
    }

    const uploadedFilePath = req.file.path;
    const { buffer, evidenceHash } = await loadEvidenceBuffer(uploadedFilePath);
    const duplicateSubmission = await CertificateSubmissionModel.findOne({
      studentAddress: req.user.address,
      evidenceHash,
    })
      .select("_id")
      .lean();

    if (duplicateSubmission) {
      return sendError(
        res,
        409,
        "DUPLICATE_EVIDENCE",
        "This evidence file has already been submitted from the same wallet"
      );
    }

    const { privateEvidenceRef } = await storeEncryptedEvidenceBuffer(buffer);
    const instituteHash = buildInstituteHash(institute.shortCode);
    const submission = await CertificateSubmissionModel.create({
      studentAddress: req.user.address,
      courseName: courseName.trim(),
      credentialType: normalizedCredentialType,
      instituteId: institute._id,
      instituteName: institute.name,
      instituteHash,
      evidenceHash,
      privateEvidenceRef,
      fileName: path.basename(req.file.originalname).replace(/[^\w.\-() ]/g, "_"),
      mimeType: req.file.mimetype,
      status: "pending_review",
      auditTrail: [
        createAuditTrailEvent({
          type: "submission_created",
          title: "Submission created",
          description:
            "Student uploaded encrypted credential evidence and submitted it for review.",
          actorAddress: req.user.address,
          metadata: {
            evidenceHash,
            credentialType: normalizedCredentialType,
            fileName: path.basename(req.file.originalname),
            instituteName: institute.name,
          },
        }),
      ],
    });

    return sendSuccess(
      res,
      {
        submission: toSubmissionResponse(submission.toObject()),
      },
      201
    );
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return sendError(
        res,
        409,
        "DUPLICATE_EVIDENCE",
        "This evidence file has already been submitted from the same wallet"
      );
    }

    return handleServerError(res, error, "Evidence upload failed");
  } finally {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => undefined);
    }
  }
});

export default router;
