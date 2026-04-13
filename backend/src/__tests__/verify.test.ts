import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";

const getBlockchainReadinessMock = jest.fn();
const ownerOfMock = jest.fn();
const certificatesMock = jest.fn();
const credentialStatusMock = jest.fn();

jest.mock("../lib/blockchainReadiness", () => ({
  getBlockchainReadiness: getBlockchainReadinessMock,
}));

jest.mock("../models/CertificateSubmission", () => ({
  CertificateSubmissionModel: {
    findOne: jest.fn(() => ({
      lean: jest.fn(async () => null),
    })),
  },
}));

jest.mock("../services/blockchain", () => ({
  eduAddress: "0x0000000000000000000000000000000000000002",
  mintControllerAddress: "0x0000000000000000000000000000000000000003",
  poctAddress: "0x0000000000000000000000000000000000000001",
  poctReadContract: {
    ownerOf: ownerOfMock,
    certificates: certificatesMock,
    credentialStatus: credentialStatusMock,
  },
  getVerificationStatusLabel: jest.fn(() => "active"),
}));

jest.mock("../services/ipfs", () => ({
  buildIpfsGatewayUrl: jest.fn(),
  fetchJsonFromIPFS: jest.fn(),
}));

jest.mock("../lib/credentialExports", () => ({
  buildCredentialExports: jest.fn(),
}));

import verifyRoutes from "../routes/verify";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

describe("verify routes", () => {
  beforeEach(() => {
    getBlockchainReadinessMock.mockReset();
    ownerOfMock.mockReset();
    certificatesMock.mockReset();
    credentialStatusMock.mockReset();
  });

  it("returns 503 when blockchain readiness is degraded", async () => {
    (getBlockchainReadinessMock as any).mockResolvedValue({
      status: "degraded",
      chainId: null,
      blockNumber: null,
      contractsReady: false,
      warnings: ["rpc offline"],
      contracts: {
        poctAddress: "0x0000000000000000000000000000000000000001",
        poctDeployed: false,
        eduAddress: "0x0000000000000000000000000000000000000002",
        eduDeployed: false,
        mintControllerAddress: "0x0000000000000000000000000000000000000003",
        mintControllerDeployed: false,
      },
    });

    const res = createMockResponse();
    const handler = getRouteHandler(verifyRoutes, "get", "/:tokenId");

    await handler(
      {
        params: { tokenId: "1" },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "BLOCKCHAIN_UNAVAILABLE",
        }),
      })
    );
    expect(ownerOfMock).not.toHaveBeenCalled();
  });

  it("returns 404 only when the token genuinely does not exist", async () => {
    (getBlockchainReadinessMock as any).mockResolvedValue({
      status: "connected",
      chainId: 31337,
      blockNumber: 123456,
      contractsReady: true,
      warnings: [],
      contracts: {
        poctAddress: "0x0000000000000000000000000000000000000001",
        poctDeployed: true,
        eduAddress: "0x0000000000000000000000000000000000000002",
        eduDeployed: true,
        mintControllerAddress: "0x0000000000000000000000000000000000000003",
        mintControllerDeployed: true,
      },
    });
    (ownerOfMock as any).mockRejectedValue({
      code: "CALL_EXCEPTION",
      message: "execution reverted: ERC721NonexistentToken",
    });

    const res = createMockResponse();
    const handler = getRouteHandler(verifyRoutes, "get", "/:tokenId");

    await handler(
      {
        params: { tokenId: "999" },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "CERTIFICATE_NOT_FOUND",
        }),
      })
    );
  });

  it("returns 503 when contract reads fail for infrastructure reasons", async () => {
    (getBlockchainReadinessMock as any).mockResolvedValue({
      status: "connected",
      chainId: 31337,
      blockNumber: 123456,
      contractsReady: true,
      warnings: [],
      contracts: {
        poctAddress: "0x0000000000000000000000000000000000000001",
        poctDeployed: true,
        eduAddress: "0x0000000000000000000000000000000000000002",
        eduDeployed: true,
        mintControllerAddress: "0x0000000000000000000000000000000000000003",
        mintControllerDeployed: true,
      },
    });
    (ownerOfMock as any).mockRejectedValue(new Error("socket hang up"));

    const res = createMockResponse();
    const handler = getRouteHandler(verifyRoutes, "get", "/:tokenId");

    await handler(
      {
        params: { tokenId: "1" },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "BLOCKCHAIN_UNAVAILABLE",
        }),
      })
    );
  });
});
