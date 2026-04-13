import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";
import { ethers } from "ethers";

const findOneMock = jest.fn();
const findOneAndUpdateMock = jest.fn();
const assertInstituteReviewerAccessMock = jest.fn();
const getTransactionReceiptMock = jest.fn();
const getTransactionMock = jest.fn();
const getBlockMock = jest.fn();
const parseRevocationReceiptMock = jest.fn();

jest.mock("../models/CertificateSubmission", () => ({
  CertificateSubmissionModel: {
    findOne: findOneMock,
    findOneAndUpdate: findOneAndUpdateMock,
  },
}));

jest.mock("../models/DisclosureRecord", () => ({
  DisclosureRecordModel: {
    find: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("../lib/reviewers", () => ({
  assertInstituteReviewerAccess: assertInstituteReviewerAccessMock,
}));

jest.mock("../services/blockchain", () => ({
  mintControllerAddress: "0x0000000000000000000000000000000000000003",
  parseRevocationReceipt: parseRevocationReceiptMock,
  provider: {
    getTransactionReceipt: getTransactionReceiptMock,
    getTransaction: getTransactionMock,
    getBlock: getBlockMock,
  },
}));

import credentialRoutes from "../routes/credentials";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

function createSubmissionDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    _id: "507f1f77bcf86cd799439011",
    instituteId: "507f1f77bcf86cd799439012",
    studentAddress: "0x1111111111111111111111111111111111111111",
    courseName: "Distributed Systems",
    instituteName: "Institute of Technology",
    instituteHash: "0xabc",
    evidenceHash: "evidence-hash",
    fileName: "credential.pdf",
    mimeType: "application/pdf",
    status: "minted",
    verificationStatus: "active",
    tokenId: "7",
    txHash: "0xmint",
    uploadedAt: new Date("2026-04-10T00:00:00.000Z"),
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

describe("credential routes", () => {
  beforeEach(() => {
    findOneMock.mockReset();
    findOneAndUpdateMock.mockReset();
    assertInstituteReviewerAccessMock.mockReset();
    getTransactionReceiptMock.mockReset();
    getTransactionMock.mockReset();
    getBlockMock.mockReset();
    parseRevocationReceiptMock.mockReset();
    (assertInstituteReviewerAccessMock as any).mockResolvedValue(true);
  });

  it("finalizes a revocation for a minted credential", async () => {
    const reasonHash = ethers.id("Credential revoked");
    const submission = createSubmissionDoc();
    const revokedSubmission = createSubmissionDoc({
      verificationStatus: "revoked",
      revokedAt: new Date("2026-04-11T00:00:00.000Z"),
      revocationReason: "Credential revoked",
      revocationReasonHash: reasonHash,
    });

    (findOneMock as any).mockResolvedValue(submission);
    (getTransactionReceiptMock as any).mockResolvedValue({
      blockNumber: 50,
    });
    (getTransactionMock as any).mockResolvedValue({
      to: "0x0000000000000000000000000000000000000003",
      from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    (parseRevocationReceiptMock as any).mockReturnValue({
      tokenId: "7",
      revoker: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      reasonHash,
    });
    (getBlockMock as any).mockResolvedValue({ timestamp: 1712793600 });
    (findOneAndUpdateMock as any).mockResolvedValue(revokedSubmission);

    const res = createMockResponse();
    res.locals.requestId = "req-123";
    const handler = getRouteHandler(
      credentialRoutes,
      "post",
      "/:tokenId/revoke/finalize"
    );

    await handler(
      {
        params: { tokenId: "7" },
        body: {
          txHash: "0xrevoke",
          reason: "Credential revoked",
        },
        user: {
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          role: "verifier",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(findOneAndUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenId: "7",
        status: "minted",
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          verificationStatus: "revoked",
          revocationReason: "Credential revoked",
        }),
      }),
      { new: true }
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        submission: expect.objectContaining({
          verificationStatus: "revoked",
          tokenId: "7",
        }),
      })
    );
  });

  it("blocks revocation when the submission is not currently minted", async () => {
    (findOneMock as any).mockResolvedValue(
      createSubmissionDoc({ status: "pending_review" })
    );

    const res = createMockResponse();
    const handler = getRouteHandler(
      credentialRoutes,
      "post",
      "/:tokenId/revoke/finalize"
    );

    await handler(
      {
        params: { tokenId: "7" },
        body: { txHash: "0xrevoke" },
        user: {
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          role: "verifier",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "SUBMISSION_NOT_REVOCABLE",
        }),
      })
    );
  });

  it("rejects revocation reasons that exceed the configured cap", async () => {
    const res = createMockResponse();
    const handler = getRouteHandler(
      credentialRoutes,
      "post",
      "/:tokenId/revoke/finalize"
    );

    await handler(
      {
        params: { tokenId: "7" },
        body: {
          txHash: "0xrevoke",
          reason: "A".repeat(1001),
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          message: "Revocation reason must be 1000 characters or fewer",
        }),
      })
    );
  });
});
