import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";

const instituteFindOneMock = jest.fn();
const instituteCreateMock = jest.fn();
const instituteFindByIdMock = jest.fn();

jest.mock("../models/Institute", () => ({
  InstituteModel: {
    findOne: instituteFindOneMock,
    create: instituteCreateMock,
    findById: instituteFindByIdMock,
  },
}));

jest.mock("../models/CertificateSubmission", () => ({
  CertificateSubmissionModel: {
    aggregate: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

import instituteRoutes from "../routes/institutes";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

function buildLeanResult(result: unknown) {
  return {
    lean: jest.fn(async () => result),
  };
}

function createInstituteDoc(overrides: Partial<Record<string, unknown>> = {}) {
  const base = {
    _id: "507f1f77bcf86cd799439011",
    name: "Institute of Technology",
    slug: "institute-of-technology",
    shortCode: "IOT",
    isActive: true,
    verifierAddresses: ["0x1111111111111111111111111111111111111111"],
    createdAt: new Date("2026-04-10T00:00:00.000Z"),
    updatedAt: new Date("2026-04-10T00:00:00.000Z"),
    save: jest.fn(),
    toObject() {
      return {
        ...base,
        ...overrides,
      };
    },
  };

  (base.save as any).mockResolvedValue(base);

  return Object.assign(base, overrides);
}

describe("institute routes", () => {
  beforeEach(() => {
    instituteFindOneMock.mockReset();
    instituteCreateMock.mockReset();
    instituteFindByIdMock.mockReset();
  });

  it("creates a new institute for an admin and normalizes the payload", async () => {
    const createdInstitute = createInstituteDoc({
      name: "Demo Institute",
      slug: "demo-institute",
      shortCode: "DEMO",
      verifierAddresses: [
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ],
    });

    (instituteFindOneMock as any).mockReturnValue(buildLeanResult(null));
    (instituteCreateMock as any).mockResolvedValue(createdInstitute);

    const res = createMockResponse();
    const handler = getRouteHandler(instituteRoutes, "post", "/");

    await handler(
      {
        body: {
          name: "  Demo Institute  ",
          shortCode: "demo",
          verifierAddresses: [
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          ],
        },
        user: {
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          role: "admin",
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(201);
    expect(instituteCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Demo Institute",
        slug: "demo-institute",
        shortCode: "DEMO",
        verifierAddresses: [
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ],
      })
    );
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        institute: expect.objectContaining({
          name: "Demo Institute",
          shortCode: "DEMO",
        }),
      })
    );
  });

  it("updates institute metadata and verifier addresses for an admin", async () => {
    const instituteDoc = createInstituteDoc();

    (instituteFindByIdMock as any).mockResolvedValue(instituteDoc);
    (instituteFindOneMock as any).mockReturnValue(buildLeanResult(null));

    const res = createMockResponse();
    const handler = getRouteHandler(instituteRoutes, "patch", "/:id");

    await handler(
      {
        params: { id: String(instituteDoc._id) },
        body: {
          name: "Updated Institute",
          shortCode: "upd",
          isActive: false,
          verifierAddresses: [
            "0xcccccccccccccccccccccccccccccccccccccccc",
          ],
        },
      } as unknown as Request,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(instituteDoc.name).toBe("Updated Institute");
    expect(instituteDoc.shortCode).toBe("UPD");
    expect(instituteDoc.slug).toBe("updated-institute");
    expect(instituteDoc.isActive).toBe(false);
    expect(instituteDoc.verifierAddresses).toEqual([
      "0xcccccccccccccccccccccccccccccccccccccccc",
    ]);
    expect(instituteDoc.save).toHaveBeenCalled();
  });

  it("rejects create requests when the institute name exceeds the configured cap", async () => {
    const res = createMockResponse();
    const handler = getRouteHandler(instituteRoutes, "post", "/");

    await handler(
      {
        body: {
          name: "A".repeat(121),
          shortCode: "VALID",
        },
        user: {
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          role: "admin",
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
          fieldErrors: expect.objectContaining({
            name: "Use 120 characters or fewer",
          }),
        }),
      })
    );
  });

  it("rejects update requests when the short code exceeds the configured cap", async () => {
    const res = createMockResponse();
    const handler = getRouteHandler(instituteRoutes, "patch", "/:id");

    await handler(
      {
        params: { id: "507f1f77bcf86cd799439011" },
        body: {
          shortCode: "TOO-LONG-SHORTCODE",
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
          fieldErrors: expect.objectContaining({
            shortCode: "Use 16 characters or fewer",
          }),
        }),
      })
    );
  });
});
