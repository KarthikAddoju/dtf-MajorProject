import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";

const certificateSubmissionFindMock: jest.Mock = jest.fn();
const certificateSubmissionFindOneAndUpdateMock: jest.Mock = jest.fn();
const providerGetBlockNumberMock: jest.Mock = jest.fn();
const poctOwnerOfMock: jest.Mock = jest.fn();

jest.mock("../models/CertificateSubmission", () => ({
  CertificateSubmissionModel: {
    find: certificateSubmissionFindMock,
    findOneAndUpdate: certificateSubmissionFindOneAndUpdateMock,
  },
  MINT_STATES: ["unprepared", "prepared", "minted"],
}));

jest.mock("../models/Institute", () => ({
  InstituteModel: {
    findById: jest.fn(),
  },
}));

jest.mock("../services/publicProof", () => ({
  buildPreparedPublicProof: jest.fn(),
}));

jest.mock("../services/ipfs", () => ({
  uploadJsonToIPFS: jest.fn(),
  buildIpfsGatewayUrl: jest.fn((cid: string) => `https://gateway.example/ipfs/${cid}`),
}));

jest.mock("../lib/reviewers", () => ({
  assertInstituteReviewerAccess: jest.fn(),
}));

jest.mock("../services/blockchain", () => ({
  mintControllerAbi: [
    "event DualMinted(address indexed student,uint256 indexed poctTokenId,uint256 eduAmount,address verifier,bytes32 instituteHash,bytes32 claimsRoot,string publicProofCid,uint64 expiresAt)",
    "function dualMint(address student,string publicProofCid,bytes32 claimsRoot,bytes32 instituteHash,uint256 eduAmount,uint64 expiresAt) external returns (uint256)",
    "function revokeCredential(uint256 tokenId,bytes32 reasonHash) external",
  ],
  mintControllerAddress: "0x0000000000000000000000000000000000000003",
  parseDualMintReceipt: jest.fn(),
  poctReadContract: {
    ownerOf: poctOwnerOfMock,
  },
  provider: {
    getBlockNumber: providerGetBlockNumberMock,
    getTransactionReceipt: jest.fn(),
    getTransaction: jest.fn(),
    getBlock: jest.fn(),
  },
}));

import reviewRoutes from "../routes/reviews";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

describe("review reset route", () => {
  beforeEach(() => {
    certificateSubmissionFindMock.mockReset();
    certificateSubmissionFindOneAndUpdateMock.mockReset();
    providerGetBlockNumberMock.mockReset();
    poctOwnerOfMock.mockReset();
    (providerGetBlockNumberMock as any).mockResolvedValue(123);
  });

  it("resets minted submissions whose token no longer exists on the active chain", async () => {
    (certificateSubmissionFindMock as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn(async () => [
          { _id: "507f1f77bcf86cd799439011", tokenId: "12" },
          { _id: "507f1f77bcf86cd799439012", tokenId: "13" },
        ]),
      }),
    });
    (poctOwnerOfMock as any).mockImplementation(async (tokenId: unknown) => {
      if (tokenId === 12n) {
        throw new Error("missing token");
      }

      return "0x1111111111111111111111111111111111111111";
    });
    (certificateSubmissionFindOneAndUpdateMock as any).mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
    });

    const res = createMockResponse();
    const handler = getRouteHandler(reviewRoutes, "post", "/reset-stale-mints");

    await handler(
      {
        user: {
          address: "0x2222222222222222222222222222222222222222",
          role: "admin",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        resetCount: 1,
        resetSubmissionIds: ["507f1f77bcf86cd799439011"],
        resetTokenIds: ["12"],
      })
    );
    expect(certificateSubmissionFindOneAndUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "507f1f77bcf86cd799439011",
        status: "minted",
        tokenId: "12",
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "pending_review",
          mintState: "unprepared",
          tokenId: null,
          mintDraft: null,
        }),
        $push: expect.objectContaining({
          auditTrail: expect.objectContaining({
            type: "submission_reset",
            metadata: expect.objectContaining({
              previousTokenId: "12",
              resetReason: "stale_chain_restart",
            }),
          }),
        }),
      }),
      { new: true }
    );
  });
});
