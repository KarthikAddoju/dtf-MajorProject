import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";

const certificateSubmissionFindByIdMock: jest.Mock = jest.fn();
const certificateSubmissionFindOneAndUpdateMock: jest.Mock = jest.fn();
const assertInstituteReviewerAccessMock: jest.Mock = jest.fn();

jest.mock("../models/CertificateSubmission", () => ({
  CertificateSubmissionModel: {
    findById: certificateSubmissionFindByIdMock,
    findOneAndUpdate: certificateSubmissionFindOneAndUpdateMock,
  },
}));

jest.mock("../lib/reviewers", () => ({
  buildReviewerSubmissionScope: jest.fn(),
  assertInstituteReviewerAccess: assertInstituteReviewerAccessMock,
}));

import submissionRoutes from "../routes/submissions";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

function createSubmissionDoc(
  overrides: Partial<Record<string, unknown>> = {}
) {
  const base = {
    _id: "507f1f77bcf86cd799439011",
    instituteId: "507f1f77bcf86cd799439012",
    studentAddress: "0x1111111111111111111111111111111111111111",
    courseName: "Distributed Systems",
    credentialType: "course",
    instituteName: "Anna University",
    instituteHash: "0xinstitutehash",
    evidenceHash: "hash-123",
    fileName: "distributed-systems.pdf",
    mimeType: "application/pdf",
    status: "rejected",
    mintState: "unprepared",
    mintDraft: null,
    reviewNote: "Needs clearer evidence",
    uploadedAt: new Date("2026-04-06T00:00:00.000Z"),
    reviewedAt: new Date("2026-04-07T00:00:00.000Z"),
    auditTrail: [],
    toObject() {
      return {
        ...base,
        ...overrides,
      };
    },
  };

  return Object.assign(base, overrides);
}

describe("submission routes", () => {
  beforeEach(() => {
    certificateSubmissionFindByIdMock.mockReset();
    certificateSubmissionFindOneAndUpdateMock.mockReset();
    assertInstituteReviewerAccessMock.mockReset();
    (assertInstituteReviewerAccessMock as any).mockResolvedValue(true);
  });

  it("returns 409 when a pending submission is processed before the atomic reject update", async () => {
    const pendingSubmission = createSubmissionDoc({
      status: "pending_review",
      mintState: "prepared",
    });

    (certificateSubmissionFindByIdMock as any).mockResolvedValue(pendingSubmission);
    (certificateSubmissionFindOneAndUpdateMock as any).mockResolvedValue(null);

    const res = createMockResponse();
    const handler = getRouteHandler(submissionRoutes, "post", "/:id/reject");

    await handler(
      {
        params: { id: String(pendingSubmission._id) },
        body: { reviewNote: "Reject after review" },
        user: {
          address: "0x2222222222222222222222222222222222222222",
          role: "admin",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "ALREADY_PROCESSED",
        }),
      })
    );
    expect(certificateSubmissionFindOneAndUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: String(pendingSubmission._id),
        status: "pending_review",
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "rejected",
          mintState: "unprepared",
        }),
      }),
      { new: true }
    );
  });
});
