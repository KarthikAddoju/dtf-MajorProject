import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";
import { ethers } from "ethers";

const certificateSubmissionFindByIdMock: jest.Mock = jest.fn();
const certificateSubmissionFindOneAndUpdateMock: jest.Mock = jest.fn();
const instituteFindByIdMock: jest.Mock = jest.fn();
const buildPreparedPublicProofMock: jest.Mock = jest.fn();
const uploadJsonToIPFSMock: jest.Mock = jest.fn();
const assertInstituteReviewerAccessMock: jest.Mock = jest.fn();
const getTransactionReceiptMock: jest.Mock = jest.fn();
const getTransactionMock: jest.Mock = jest.fn();
const getBlockMock: jest.Mock = jest.fn();
const parseDualMintReceiptMock: jest.Mock = jest.fn();

jest.mock("../models/CertificateSubmission", () => ({
  CertificateSubmissionModel: {
    findById: certificateSubmissionFindByIdMock,
    findOneAndUpdate: certificateSubmissionFindOneAndUpdateMock,
  },
  MINT_STATES: ["unprepared", "prepared", "minted"],
}));

jest.mock("../models/Institute", () => ({
  InstituteModel: {
    findById: instituteFindByIdMock,
  },
}));

jest.mock("../services/publicProof", () => ({
  buildPreparedPublicProof: buildPreparedPublicProofMock,
}));

jest.mock("../services/ipfs", () => ({
  uploadJsonToIPFS: uploadJsonToIPFSMock,
  buildIpfsGatewayUrl: jest.fn((cid: string) => `https://gateway.example/ipfs/${cid}`),
}));

jest.mock("../lib/reviewers", () => ({
  assertInstituteReviewerAccess: assertInstituteReviewerAccessMock,
}));

jest.mock("../services/blockchain", () => ({
  mintControllerAbi: [
    "event DualMinted(address indexed student,uint256 indexed poctTokenId,uint256 eduAmount,address verifier,bytes32 instituteHash,bytes32 claimsRoot,string publicProofCid,uint64 expiresAt)",
    "function dualMint(address student,string publicProofCid,bytes32 claimsRoot,bytes32 instituteHash,uint256 eduAmount,uint64 expiresAt) external returns (uint256)",
    "function revokeCredential(uint256 tokenId,bytes32 reasonHash) external",
  ],
  mintControllerAddress: "0x0000000000000000000000000000000000000003",
  parseDualMintReceipt: parseDualMintReceiptMock,
  provider: {
    getTransactionReceipt: getTransactionReceiptMock,
    getTransaction: getTransactionMock,
    getBlock: getBlockMock,
  },
}));

import reviewRoutes from "../routes/reviews";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

function buildLeanResult(result: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn(async () => result),
    }),
  };
}

function createSubmissionDoc(
  overrides: Partial<Record<string, unknown>> = {}
) {
  const base = {
    _id: "507f1f77bcf86cd799439011",
    studentAddress: "0x1111111111111111111111111111111111111111",
    courseName: "Distributed Systems",
    credentialType: "course",
    instituteId: "507f1f77bcf86cd799439012",
    instituteName: "Anna University",
    instituteHash: ethers.keccak256(ethers.toUtf8Bytes("ANNAU")),
    evidenceHash: "hash-123",
    fileName: "distributed-systems.pdf",
    mimeType: "application/pdf",
    status: "pending_review",
    mintState: "unprepared",
    mintDraft: null,
    reviewNote: null,
    uploadedAt: new Date("2026-04-06T00:00:00.000Z"),
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

describe("review routes", () => {
  beforeEach(() => {
    certificateSubmissionFindByIdMock.mockReset();
    certificateSubmissionFindOneAndUpdateMock.mockReset();
    instituteFindByIdMock.mockReset();
    buildPreparedPublicProofMock.mockReset();
    uploadJsonToIPFSMock.mockReset();
    assertInstituteReviewerAccessMock.mockReset();
    getTransactionReceiptMock.mockReset();
    getTransactionMock.mockReset();
    getBlockMock.mockReset();
    parseDualMintReceiptMock.mockReset();
    (assertInstituteReviewerAccessMock as any).mockResolvedValue(true);
  });

  it("returns the existing mint draft when prepare-mint is retried", async () => {
    const existingSubmission = createSubmissionDoc({
      mintState: "prepared",
      mintDraft: {
        publicProofCid: "bafy-proof",
        publicProofPayload: { cid: "bafy-proof" },
        claimsRoot: ethers.keccak256(ethers.toUtf8Bytes("claims-root")),
        claimSet: { courseName: "Distributed Systems" },
        eduAmount: 25,
        eduAmountWei: ethers.parseUnits("25", 18).toString(),
        expiresAt: new Date("2026-12-31T00:00:00.000Z"),
        preparedBy: "0x2222222222222222222222222222222222222222",
        preparedAt: new Date("2026-04-06T09:00:00.000Z"),
      },
      reviewNote: "Ready for mint",
    });

    (certificateSubmissionFindByIdMock as any).mockResolvedValue(existingSubmission);

    const res = createMockResponse();
    const handler = getRouteHandler(reviewRoutes, "post", "/:submissionId/prepare-mint");

    await handler(
      {
        params: { submissionId: String(existingSubmission._id) },
        body: {
          eduAmount: 25,
          reviewNote: "Ready for mint",
          expiresAt: "2026-12-31T00:00:00.000Z",
        },
        user: {
          address: "0x2222222222222222222222222222222222222222",
          role: "verifier",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        mintPayload: expect.objectContaining({
          publicProofCid: "bafy-proof",
          eduAmountWei: ethers.parseUnits("25", 18).toString(),
        }),
      })
    );
    expect(buildPreparedPublicProofMock).not.toHaveBeenCalled();
    expect(uploadJsonToIPFSMock).not.toHaveBeenCalled();
    expect(certificateSubmissionFindOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects finalize-mint when the transaction receipt reverted", async () => {
    const preparedSubmission = createSubmissionDoc({
      mintState: "prepared",
      mintDraft: {
        publicProofCid: "bafy-proof",
        publicProofPayload: { cid: "bafy-proof" },
        claimsRoot: ethers.keccak256(ethers.toUtf8Bytes("claims-root")),
        claimSet: { courseName: "Distributed Systems" },
        eduAmount: 25,
        eduAmountWei: ethers.parseUnits("25", 18).toString(),
        expiresAt: null,
        preparedBy: "0x2222222222222222222222222222222222222222",
        preparedAt: new Date("2026-04-06T09:00:00.000Z"),
      },
    });

    (certificateSubmissionFindByIdMock as any).mockResolvedValue(preparedSubmission);
    (getTransactionReceiptMock as any).mockResolvedValue({ status: 0 });
    (getTransactionMock as any).mockResolvedValue({
      to: "0x0000000000000000000000000000000000000003",
      from: "0x1111111111111111111111111111111111111111",
      data: "0x",
      value: 0n,
    });

    const res = createMockResponse();
    const handler = getRouteHandler(reviewRoutes, "post", "/:submissionId/finalize-mint");

    await handler(
      {
        params: { submissionId: String(preparedSubmission._id) },
        body: { txHash: "0xtxhash" },
        user: {
          address: "0x1111111111111111111111111111111111111111",
          role: "student",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "TX_FAILED",
        }),
      })
    );
  });

  it("rejects finalize-mint when the controller call is not dualMint", async () => {
    const preparedSubmission = createSubmissionDoc({
      mintState: "prepared",
      mintDraft: {
        publicProofCid: "bafy-proof",
        publicProofPayload: { cid: "bafy-proof" },
        claimsRoot: ethers.keccak256(ethers.toUtf8Bytes("claims-root")),
        claimSet: { courseName: "Distributed Systems" },
        eduAmount: 25,
        eduAmountWei: ethers.parseUnits("25", 18).toString(),
        expiresAt: null,
        preparedBy: "0x2222222222222222222222222222222222222222",
        preparedAt: new Date("2026-04-06T09:00:00.000Z"),
      },
    });
    const mintControllerInterface = new ethers.Interface([
      "function dualMint(address student,string publicProofCid,bytes32 claimsRoot,bytes32 instituteHash,uint256 eduAmount,uint64 expiresAt) external returns (uint256)",
      "function revokeCredential(uint256 tokenId,bytes32 reasonHash) external",
    ]);

    (certificateSubmissionFindByIdMock as any).mockResolvedValue(preparedSubmission);
    (getTransactionReceiptMock as any).mockResolvedValue({ status: 1 });
    (getTransactionMock as any).mockResolvedValue({
      to: "0x0000000000000000000000000000000000000003",
      from: "0x1111111111111111111111111111111111111111",
      data: mintControllerInterface.encodeFunctionData("revokeCredential", [
        1n,
        ethers.ZeroHash,
      ]),
      value: 0n,
    });

    const res = createMockResponse();
    const handler = getRouteHandler(reviewRoutes, "post", "/:submissionId/finalize-mint");

    await handler(
      {
        params: { submissionId: String(preparedSubmission._id) },
        body: { txHash: "0xtxhash" },
        user: {
          address: "0x1111111111111111111111111111111111111111",
          role: "student",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_TRANSACTION",
          message: "Transaction did not call the expected mint function",
        }),
      })
    );
  });
});
