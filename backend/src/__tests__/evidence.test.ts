import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";

const certificateSubmissionFindByIdMock: jest.Mock = jest.fn();
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
  readEncryptedEvidence: readEncryptedEvidenceMock,
}));

jest.mock("../services/geminiAnalyser", () => ({
  analyseCertificate: jest.fn(),
}));

import evidenceRoutes from "../routes/evidence";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

describe("evidence routes", () => {
  beforeEach(() => {
    certificateSubmissionFindByIdMock.mockReset();
    readEncryptedEvidenceMock.mockReset();
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
});
