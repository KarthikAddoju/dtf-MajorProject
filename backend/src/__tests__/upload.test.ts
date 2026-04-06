import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";

const certificateSubmissionFindOneMock: jest.Mock = jest.fn();
const certificateSubmissionCreateMock: jest.Mock = jest.fn();
const instituteFindByIdMock: jest.Mock = jest.fn();
const loadEvidenceBufferMock: jest.Mock = jest.fn();
const storeEncryptedEvidenceBufferMock: jest.Mock = jest.fn();

jest.mock("multer", () => {
  const multerMock = () => ({
    single: () => (_req: unknown, _res: unknown, next: (error?: Error) => void) =>
      next(),
  });

  class MockMulterError extends Error {
    code: string;

    constructor(code: string, field?: string) {
      super(field ? `${code}:${field}` : code);
      this.code = code;
    }
  }

  return {
    __esModule: true,
    default: Object.assign(multerMock, {
      MulterError: MockMulterError,
    }),
    MulterError: MockMulterError,
  };
});

jest.mock("../models/CertificateSubmission", () => ({
  CertificateSubmissionModel: {
    findOne: certificateSubmissionFindOneMock,
    create: certificateSubmissionCreateMock,
  },
}));

jest.mock("../models/Institute", () => ({
  InstituteModel: {
    findById: instituteFindByIdMock,
  },
}));

jest.mock("../services/evidenceVault", () => ({
  loadEvidenceBuffer: loadEvidenceBufferMock,
  storeEncryptedEvidenceBuffer: storeEncryptedEvidenceBufferMock,
}));

import uploadRoutes from "../routes/upload";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

function buildLeanResult(result: unknown) {
  return {
    lean: jest.fn(async () => result),
  };
}

function buildSelectLeanResult(result: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn(async () => result),
    }),
  };
}

describe("upload route", () => {
  beforeEach(() => {
    certificateSubmissionFindOneMock.mockReset();
    certificateSubmissionCreateMock.mockReset();
    instituteFindByIdMock.mockReset();
    loadEvidenceBufferMock.mockReset();
    storeEncryptedEvidenceBufferMock.mockReset();
  });

  it("translates duplicate-key create failures into DUPLICATE_EVIDENCE", async () => {
    certificateSubmissionFindOneMock.mockReturnValue(buildSelectLeanResult(null));
    (certificateSubmissionCreateMock as any).mockRejectedValue({ code: 11000 });
    instituteFindByIdMock.mockReturnValue(
      buildLeanResult({
        _id: "507f1f77bcf86cd799439011",
        name: "Anna University",
        shortCode: "ANNAU",
        isActive: true,
      })
    );
    (loadEvidenceBufferMock as any).mockResolvedValue({
      buffer: Buffer.from("proof"),
      evidenceHash: "hash-123",
    });
    (storeEncryptedEvidenceBufferMock as any).mockResolvedValue({
      privateEvidenceRef: "vault://evidence/1",
    });

    const res = createMockResponse();
    const handler = getRouteHandler(uploadRoutes, "post", "/");

    await handler(
      {
        body: {
          courseName: "Distributed Systems",
          credentialType: "course",
          instituteId: "507f1f77bcf86cd799439011",
        },
        file: {
          path: "/tmp/fake-upload.pdf",
          originalname: "distributed-systems.pdf",
          mimetype: "application/pdf",
        },
        user: {
          address: "0x1111111111111111111111111111111111111111",
          role: "student",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "DUPLICATE_EVIDENCE",
        }),
      })
    );
    expect(certificateSubmissionCreateMock).toHaveBeenCalledTimes(1);
  });
});
