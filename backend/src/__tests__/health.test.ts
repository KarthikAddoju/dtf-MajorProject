import { describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";

jest.mock("../services/blockchain", () => ({
  eduAddress: "0x0000000000000000000000000000000000000002",
  mintControllerAddress: "0x0000000000000000000000000000000000000003",
  poctAddress: "0x0000000000000000000000000000000000000001",
  provider: {
    getNetwork: jest.fn(async () => ({ chainId: 31337n })),
    getBlockNumber: jest.fn(async () => 123456),
    getCode: jest.fn(async () => "0x1234"),
  },
}));

import healthRoutes from "../routes/health";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

describe("Health check route", () => {
  it("returns health payload with deployment readiness details", async () => {
    const res = createMockResponse();
    const handler = getRouteHandler(healthRoutes, "get", "/");

    await handler({} as Request, res);

    const payload = res.body as {
      success: boolean;
      status: string;
      services: {
        blockchain: {
          status: string;
          chainId: number | null;
          blockNumber: number | null;
          contractsReady: boolean;
        };
      };
      contracts: {
        poctAddress: string;
        poctDeployed: boolean;
        eduAddress: string;
        eduDeployed: boolean;
        mintControllerAddress: string;
        mintControllerDeployed: boolean;
      };
    };

    expect(res.statusCode).toBe(200);
    expect(payload.success).toBe(true);
    expect(["ok", "degraded"]).toContain(payload.status);
    expect(payload.services.blockchain).toEqual(
      expect.objectContaining({
        status: expect.any(String),
        chainId: expect.any(Number),
        blockNumber: expect.any(Number),
        contractsReady: true,
      })
    );
    expect(payload.contracts).toEqual(
      expect.objectContaining({
        poctAddress: "0x0000000000000000000000000000000000000001",
        poctDeployed: true,
        eduAddress: "0x0000000000000000000000000000000000000002",
        eduDeployed: true,
        mintControllerAddress: "0x0000000000000000000000000000000000000003",
        mintControllerDeployed: true,
      })
    );
  });
});
