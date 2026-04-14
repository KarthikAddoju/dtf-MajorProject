import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";

const certificateSubmissionFindByIdMock: jest.Mock = jest.fn();
const hasEncryptedEvidenceMock: jest.Mock = jest.fn();
const readEncryptedEvidenceMock: jest.Mock = jest.fn();

jest.mock("../models/CertificateSubmission", () => ({
  CertificateSubmissionModel: {
    findById: certificateSubmissionFindByIdMock,
  },
}));

jest.mock("../models/Institute", () => ({
  InstituteModel: {
    findById: jest.fn(),
  },
}));

jest.mock("../lib/reviewers", () => ({
  instituteHasVerifierAddress: jest.fn(() => false),
}));

jest.mock("../services/evidenceVault", () => ({
  hasEncryptedEvidence: hasEncryptedEvidenceMock,
  readEncryptedEvidence: readEncryptedEvidenceMock,
}));

jest.mock("../services/geminiAnalyser", () => {
  const actual = jest.requireActual("../services/geminiAnalyser") as Record<
    string,
    unknown
  >;

  return {
    ...actual,
    analyseCertificate: jest.fn(),
  };
});

import evidenceRoutes from "../routes/evidence";
import { analyseCertificate } from "../services/geminiAnalyser";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

describe("evidence routes", () => {
  beforeEach(() => {
    certificateSubmissionFindByIdMock.mockReset();
    hasEncryptedEvidenceMock.mockReset();
    readEncryptedEvidenceMock.mockReset();
    (analyseCertificate as jest.Mock).mockReset();
    (hasEncryptedEvidenceMock as any).mockResolvedValue(true);
  });

  it("strips quotes and newlines from evidence filenames in Content-Disposition", async () => {
    (certificateSubmissionFindByIdMock as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn(async () => ({
          studentAddress: "0x1111111111111111111111111111111111111111",
          instituteId: "507f1f77bcf86cd799439012",
          privateEvidenceRef: "vault/evidence-1",
          fileName: 'credential"\r\nX-Test: injected.pdf',
          mimeType: "application/pdf",
        })),
      }),
    });
    (readEncryptedEvidenceMock as any).mockResolvedValue(Buffer.from("pdf"));

    const res = createMockResponse();
    const handler = getRouteHandler(evidenceRoutes, "get", "/:submissionId");

    await handler(
      {
        params: { submissionId: "507f1f77bcf86cd799439011" },
        query: {},
        user: {
          address: "0x1111111111111111111111111111111111111111",
          role: "student",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Disposition"]).toBe(
      'inline; filename="credentialX-Test: injected.pdf"'
    );
    expect(res.contentType).toBe("application/pdf");
  });

  it("returns a metadata fallback insight when live AI analysis is unavailable", async () => {
    certificateSubmissionFindByIdMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn(async () => ({
          status: "pending_review",
          privateEvidenceRef: "11111111-1111-1111-1111-111111111111.bin",
          mimeType: "image/jpeg",
          instituteName: "Indian Institute of Technology Hyderabad",
          courseName: "aiml",
          credentialType: "course",
        })),
      }),
    });
    (readEncryptedEvidenceMock as any).mockResolvedValue(Buffer.from("jpeg"));
    (analyseCertificate as any).mockRejectedValue(
      Object.assign(new Error("Quota exceeded. Please retry in 44s."), {
        status: 429,
      })
    );

    const res = createMockResponse();
    const handler = getRouteHandler(evidenceRoutes, "post", "/:submissionId/analyse");

    await handler(
      {
        params: { submissionId: "507f1f77bcf86cd799439011" },
        user: {
          address: "0x1111111111111111111111111111111111111111",
          role: "admin",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      institution: "Indian Institute of Technology Hyderabad",
      courseName: "aiml",
      credentialType: "course",
      confidence: "low",
      suggestedEduAmount: 22,
      source: "fallback",
    });
    expect((res.body as { warning: string }).warning).toContain(
      "metadata-only fallback"
    );
  });
});
