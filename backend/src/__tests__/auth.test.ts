import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";

const loginChallengeFindOneAndUpdateMock: jest.Mock = jest.fn();
const loginChallengeCreateMock: jest.Mock = jest.fn();
const loginChallengeDeleteManyMock: jest.Mock = jest.fn();
const instituteFindOneMock: jest.Mock = jest.fn();
const siweVerifyMock: jest.Mock = jest.fn();

jest.mock("../models/LoginChallenge", () => ({
  LoginChallengeModel: {
    findOneAndUpdate: loginChallengeFindOneAndUpdateMock,
    create: loginChallengeCreateMock,
    deleteMany: loginChallengeDeleteManyMock,
  },
}));

jest.mock("../models/Institute", () => ({
  InstituteModel: {
    findOne: instituteFindOneMock,
  },
}));

jest.mock("siwe", () => ({
  generateNonce: jest.fn(() => "test-nonce"),
  SiweMessage: jest.fn().mockImplementation(() => ({
    verify: siweVerifyMock,
  })),
}));

import authRoutes from "../routes/auth";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

describe("auth verify route", () => {
  beforeEach(() => {
    loginChallengeFindOneAndUpdateMock.mockReset();
    loginChallengeCreateMock.mockReset();
    loginChallengeDeleteManyMock.mockReset();
    instituteFindOneMock.mockReset();
    siweVerifyMock.mockReset();
  });

  it("rejects SIWE messages with a mismatched domain", async () => {
    (siweVerifyMock as any).mockResolvedValue({
      data: {
        address: "0x1111111111111111111111111111111111111111",
        nonce: "nonce-1",
        domain: "malicious.example",
        uri: "http://localhost:3000",
      },
    });

    const res = createMockResponse();
    const handler = getRouteHandler(authRoutes, "post", "/verify");

    await handler(
      {
        body: {
          address: "0x1111111111111111111111111111111111111111",
          signature: "0xsig",
          message: "signed message",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_MESSAGE",
          message: "SIWE domain did not match the configured frontend host",
        }),
      })
    );
    expect(loginChallengeFindOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects SIWE messages with a mismatched origin URI", async () => {
    (siweVerifyMock as any).mockResolvedValue({
      data: {
        address: "0x1111111111111111111111111111111111111111",
        nonce: "nonce-2",
        domain: "localhost:3000",
        uri: "http://localhost:9999",
      },
    });

    const res = createMockResponse();
    const handler = getRouteHandler(authRoutes, "post", "/verify");

    await handler(
      {
        body: {
          address: "0x1111111111111111111111111111111111111111",
          signature: "0xsig",
          message: "signed message",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_MESSAGE",
          message: "SIWE URI did not match the configured frontend origin",
        }),
      })
    );
    expect(loginChallengeFindOneAndUpdateMock).not.toHaveBeenCalled();
  });
});
