import { Router } from "express";
import { isAddress } from "ethers";
import { sendError, sendSuccess, handleServerError } from "../lib/api";
import { InstituteModel } from "../models/Institute";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";
import { authenticate, authorize, type AuthRequest } from "../middleware/authMiddleware";
import { isNonEmptyString, isOptionalString, isValidObjectId, slugify } from "../lib/validation";
import { uniqueWalletAddresses } from "../lib/institutes";
import { toSubmissionResponse } from "../lib/submissionResponses";

const router = Router();

function toInstituteResponse(institute: {
  _id: unknown;
  name: string;
  slug: string;
  shortCode: string;
  isActive: boolean;
  verifierAddresses?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(institute._id),
    name: institute.name,
    slug: institute.slug,
    shortCode: institute.shortCode,
    isActive: institute.isActive,
    verifierAddresses: institute.verifierAddresses ?? [],
    createdAt: institute.createdAt?.toISOString() ?? null,
    updatedAt: institute.updatedAt?.toISOString() ?? null,
  };
}

router.get("/", async (_req, res) => {
  try {
    const institutes = await InstituteModel.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, {
      institutes: institutes.map(toInstituteResponse),
    });
  } catch (error) {
    return handleServerError(res, error, "Could not load institutes");
  }
});

router.get("/manage", authenticate, authorize("admin"), async (_req, res) => {
  try {
    const institutes = await InstituteModel.find()
      .sort({ name: 1 })
      .lean();

    return sendSuccess(res, {
      institutes: institutes.map(toInstituteResponse),
    });
  } catch (error) {
    return handleServerError(res, error, "Could not load institute management data");
  }
});

router.get("/:slug/profile", async (req, res) => {
  try {
    const slug = String(req.params.slug);

    const institute = await InstituteModel.findOne({ slug }).lean();

    if (!institute) {
      return sendError(res, 404, "INSTITUTE_NOT_FOUND", "Institute not found");
    }

    const [summaryRows, topCourseRows, recentCredentialRows] = await Promise.all([
      CertificateSubmissionModel.aggregate<{
        totalEduMinted: number;
        mintedCredentials: number;
        uniqueStudents: number;
        pendingSubmissions: number;
        rejectedSubmissions: number;
        lastMintedAt: Date | null;
      }>([
        {
          $match: {
            instituteId: institute._id,
          },
        },
        {
          $group: {
            _id: null,
            totalEduMinted: {
              $sum: {
                $cond: [{ $eq: ["$status", "minted"] }, { $ifNull: ["$eduAmount", 0] }, 0],
              },
            },
            mintedCredentials: {
              $sum: {
                $cond: [{ $eq: ["$status", "minted"] }, 1, 0],
              },
            },
            uniqueStudents: {
              $addToSet: {
                $cond: [
                  { $eq: ["$status", "minted"] },
                  "$studentAddress",
                  "$$REMOVE",
                ],
              },
            },
            pendingSubmissions: {
              $sum: {
                $cond: [{ $eq: ["$status", "pending_review"] }, 1, 0],
              },
            },
            rejectedSubmissions: {
              $sum: {
                $cond: [{ $eq: ["$status", "rejected"] }, 1, 0],
              },
            },
            lastMintedAt: {
              $max: {
                $cond: [{ $eq: ["$status", "minted"] }, "$mintedAt", null],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalEduMinted: 1,
            mintedCredentials: 1,
            uniqueStudents: { $size: "$uniqueStudents" },
            pendingSubmissions: 1,
            rejectedSubmissions: 1,
            lastMintedAt: 1,
          },
        },
      ]),
      CertificateSubmissionModel.aggregate<{
        courseName: string;
        credentialType: string;
        mintedCount: number;
        totalEduMinted: number;
      }>([
        {
          $match: {
            instituteId: institute._id,
            status: "minted",
          },
        },
        {
          $group: {
            _id: {
              courseName: "$courseName",
              credentialType: "$credentialType",
            },
            mintedCount: { $sum: 1 },
            totalEduMinted: { $sum: { $ifNull: ["$eduAmount", 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            courseName: "$_id.courseName",
            credentialType: { $ifNull: ["$_id.credentialType", "course"] },
            mintedCount: 1,
            totalEduMinted: 1,
          },
        },
        {
          $sort: {
            mintedCount: -1 as const,
            totalEduMinted: -1 as const,
            courseName: 1 as const,
          },
        },
        {
          $limit: 6,
        },
      ]),
      CertificateSubmissionModel.find({
        instituteId: institute._id,
        status: "minted",
      })
        .sort({ mintedAt: -1, uploadedAt: -1 })
        .limit(8)
        .lean(),
    ]);

    const summary = summaryRows[0] ?? {
      totalEduMinted: 0,
      mintedCredentials: 0,
      uniqueStudents: 0,
      pendingSubmissions: 0,
      rejectedSubmissions: 0,
      lastMintedAt: null,
    };

    return sendSuccess(res, {
      profile: {
        institute: toInstituteResponse(institute),
        stats: {
          totalEduMinted: summary.totalEduMinted,
          mintedCredentials: summary.mintedCredentials,
          uniqueStudents: summary.uniqueStudents,
          pendingSubmissions: summary.pendingSubmissions,
          rejectedSubmissions: summary.rejectedSubmissions,
          lastMintedAt: summary.lastMintedAt?.toISOString() ?? null,
        },
        topCourses: topCourseRows,
        recentCredentials: recentCredentialRows.map((submission) => ({
          ...toSubmissionResponse(submission as never),
          mintedAt:
            submission.mintedAt?.toISOString() ??
            submission.reviewedAt?.toISOString() ??
            submission.uploadedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return handleServerError(res, error, "Could not load institute profile");
  }
});

router.post("/", authenticate, authorize("admin"), async (req: AuthRequest, res) => {
  try {
    const { name, shortCode, verifierAddresses } = req.body as {
      name?: string;
      shortCode?: string;
      verifierAddresses?: string[];
    };

    if (!isNonEmptyString(name) || !isNonEmptyString(shortCode)) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Institute name and short code are required",
        {
          ...(isNonEmptyString(name) ? {} : { name: "Name is required" }),
          ...(isNonEmptyString(shortCode)
            ? {}
            : { shortCode: "Short code is required" }),
        }
      );
    }

    const normalizedShortCode = shortCode.trim().toUpperCase();
    const instituteSlug = slugify(name);

    const existingInstitute = await InstituteModel.findOne({
      $or: [
        { name: name.trim() },
        { slug: instituteSlug },
        { shortCode: normalizedShortCode },
      ],
    }).lean();

    if (existingInstitute) {
      return sendError(
        res,
        409,
        "INSTITUTE_ALREADY_EXISTS",
        "An institute with that name or short code already exists"
      );
    }

    const institute = await InstituteModel.create({
      name: name.trim(),
      slug: instituteSlug,
      shortCode: normalizedShortCode,
      isActive: true,
      verifierAddresses: uniqueWalletAddresses([
        ...(Array.isArray(verifierAddresses) ? verifierAddresses : []),
        ...(req.user?.address ? [req.user.address] : []),
      ]),
    });

    return sendSuccess(
      res,
      { institute: toInstituteResponse(institute.toObject()) },
      201
    );
  } catch (error) {
    return handleServerError(res, error, "Could not create institute");
  }
});

router.patch("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const id = String(req.params.id);

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid institute id");
    }

    const { name, shortCode, isActive, verifierAddresses } = req.body as {
      name?: string;
      shortCode?: string;
      isActive?: boolean;
      verifierAddresses?: string[];
    };

    if (
      !isOptionalString(name) ||
      !isOptionalString(shortCode) ||
      (isActive !== undefined && typeof isActive !== "boolean") ||
      (verifierAddresses !== undefined &&
        (!Array.isArray(verifierAddresses) ||
          verifierAddresses.some((entry) => typeof entry !== "string")))
    ) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "The provided institute update is invalid"
      );
    }

    const institute = await InstituteModel.findById(id);

    if (!institute) {
      return sendError(res, 404, "INSTITUTE_NOT_FOUND", "Institute not found");
    }

    const nextName = name?.trim() || institute.name;
    const nextShortCode = shortCode?.trim().toUpperCase() || institute.shortCode;
    const nextSlug = slugify(nextName);

    const conflictingInstitute = await InstituteModel.findOne({
      _id: { $ne: institute._id },
      $or: [
        { name: nextName },
        { slug: nextSlug },
        { shortCode: nextShortCode },
      ],
    }).lean();

    if (conflictingInstitute) {
      return sendError(
        res,
        409,
        "INSTITUTE_ALREADY_EXISTS",
        "Another institute already uses that name or short code"
      );
    }

    institute.name = nextName;
    institute.shortCode = nextShortCode;
    institute.slug = nextSlug;

    if (typeof isActive === "boolean") {
      institute.isActive = isActive;
    }

    if (Array.isArray(verifierAddresses)) {
      if (verifierAddresses.some((addr) => !isAddress(addr))) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "All verifier addresses must be valid Ethereum addresses"
        );
      }
      institute.verifierAddresses = uniqueWalletAddresses(verifierAddresses);
    }

    await institute.save();

    return sendSuccess(res, {
      institute: toInstituteResponse(institute.toObject()),
    });
  } catch (error) {
    return handleServerError(res, error, "Could not update institute");
  }
});

export default router;
