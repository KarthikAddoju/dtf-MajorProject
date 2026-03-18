import { Router } from "express";
import type { PipelineStage } from "mongoose";
import { handleServerError, sendSuccess } from "../lib/api";
import { InstituteModel } from "../models/Institute";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";

const router = Router();

interface CollegeLeaderboardRow {
  instituteName: string;
  slug: string | null;
  totalEduMinted: number;
  mintedCertificates: number;
  uniqueStudents: number;
  lastMintedAt: Date | null;
}

function buildCollegeLeaderboardAggregation() {
  return [
    {
      $match: {
        status: "minted",
      },
    },
    {
      $group: {
        _id: {
          instituteId: "$instituteId",
          instituteName: "$instituteName",
        },
        totalEduMinted: { $sum: "$eduAmount" },
        mintedCertificates: { $sum: 1 },
        uniqueStudents: { $addToSet: "$studentAddress" },
        lastMintedAt: { $max: "$mintedAt" },
      },
    },
    {
      $lookup: {
        from: "institutes",
        localField: "_id.instituteId",
        foreignField: "_id",
        as: "institute",
      },
    },
    {
      $project: {
        _id: 0,
        instituteName: "$_id.instituteName",
        slug: { $ifNull: [{ $arrayElemAt: ["$institute.slug", 0] }, null] },
        totalEduMinted: 1,
        mintedCertificates: 1,
        uniqueStudents: { $size: "$uniqueStudents" },
        lastMintedAt: 1,
      },
    },
    {
      $sort: {
        totalEduMinted: -1 as const,
        mintedCertificates: -1 as const,
        instituteName: 1 as const,
      },
    },
  ] satisfies PipelineStage[];
}

async function getCollegeLeaderboard() {
  const leaderboard = await CertificateSubmissionModel.aggregate<CollegeLeaderboardRow>(
    buildCollegeLeaderboardAggregation()
  );

  return leaderboard.map((entry, index) => ({
    rank: index + 1,
    instituteName: entry.instituteName,
    slug: entry.slug,
    totalEduMinted: entry.totalEduMinted,
    mintedCertificates: entry.mintedCertificates,
    uniqueStudents: entry.uniqueStudents,
    lastMintedAt: entry.lastMintedAt?.toISOString() ?? null,
  }));
}

router.get("/colleges", async (_req, res) => {
  try {
    const colleges = await getCollegeLeaderboard();

    return sendSuccess(res, {
      colleges,
    });
  } catch (error) {
    return handleServerError(res, error, "Could not load college leaderboard");
  }
});

router.get("/overview", async (_req, res) => {
  try {
    const [colleges, summaryRows, recentActivityRows, activeInstitutes] =
      await Promise.all([
        getCollegeLeaderboard(),
        CertificateSubmissionModel.aggregate<{
          totalEduMinted: number;
          mintedCredentials: number;
          uniqueStudents: number;
        }>([
          {
            $match: {
              status: "minted",
            },
          },
          {
            $group: {
              _id: null,
              totalEduMinted: { $sum: "$eduAmount" },
              mintedCredentials: { $sum: 1 },
              uniqueStudents: { $addToSet: "$studentAddress" },
            },
          },
          {
            $project: {
              _id: 0,
              totalEduMinted: 1,
              mintedCredentials: 1,
              uniqueStudents: { $size: "$uniqueStudents" },
            },
          },
        ]),
        CertificateSubmissionModel.find({
          status: "minted",
        })
          .sort({ mintedAt: -1, uploadedAt: -1 })
          .limit(6)
          .lean(),
        InstituteModel.countDocuments({ isActive: true }),
      ]);

    const summary = summaryRows[0] ?? {
      totalEduMinted: 0,
      mintedCredentials: 0,
      uniqueStudents: 0,
    };

    return sendSuccess(res, {
      overview: {
        activeInstitutes,
        totalEduMinted: summary.totalEduMinted,
        mintedCredentials: summary.mintedCredentials,
        uniqueStudents: summary.uniqueStudents,
        leadInstituteName: colleges[0]?.instituteName ?? null,
        recentActivity: recentActivityRows.map((submission) => ({
          id: String(submission._id),
          tokenId: submission.tokenId ?? null,
          courseName: submission.courseName,
          credentialType: submission.credentialType ?? "course",
          instituteName: submission.instituteName,
          studentAddress: submission.studentAddress,
          verifierAddress: submission.verifierAddress ?? null,
          eduAmount: submission.eduAmount ?? null,
          mintedAt:
            submission.mintedAt?.toISOString() ??
            submission.reviewedAt?.toISOString() ??
            submission.uploadedAt.toISOString(),
          cid: submission.cid,
          txHash: submission.txHash ?? null,
          ipfsUrl: `https://ipfs.io/ipfs/${submission.cid}`,
        })),
      },
    });
  } catch (error) {
    return handleServerError(res, error, "Could not load analytics overview");
  }
});

export default router;
