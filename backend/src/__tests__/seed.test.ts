import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const findMock = jest.fn();
const insertManyMock = jest.fn();

jest.mock("../models/Institute", () => ({
  InstituteModel: {
    find: findMock,
    insertMany: insertManyMock,
  },
}));

jest.mock("../config/runtime", () => ({
  runtimeConfig: {
    seedDefaultInstitutes: true,
    bootstrapVerifierAddresses: [
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
    ],
  },
}));

import { seedDefaultInstitutes } from "../services/seed";

function buildFindResult(result: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn(async () => result),
    }),
  };
}

describe("seedDefaultInstitutes", () => {
  beforeEach(() => {
    findMock.mockReset();
    insertManyMock.mockReset();
  });

  it("does not insert duplicates when the seeded institutes already exist", async () => {
    findMock.mockReturnValue(
      buildFindResult([
        {
          name: "Indian Institute of Technology Hyderabad",
          slug: "indian-institute-of-technology-hyderabad",
          shortCode: "IITH",
        },
        {
          name: "Anna University",
          slug: "anna-university",
          shortCode: "ANNAU",
        },
      ])
    );

    await seedDefaultInstitutes();

    expect(insertManyMock).toHaveBeenCalledTimes(1);
    const insertedRows = insertManyMock.mock.calls[0]?.[0] as
      | Array<Record<string, unknown>>
      | undefined;

    expect(insertedRows).toBeDefined();
    expect(insertedRows).toHaveLength(48);
    expect(
      insertedRows?.some(
        (row) => row.name === "Indian Institute of Technology Hyderabad"
      )
    ).toBe(false);
    expect(
      insertedRows?.some((row) => row.name === "Anna University")
    ).toBe(false);
  });

  it("adds verifier defaults and activation flags to inserted institutes", async () => {
    findMock.mockReturnValue(buildFindResult([]));

    await seedDefaultInstitutes();

    const insertedRows = insertManyMock.mock.calls[0]?.[0] as Array<
      Record<string, unknown>
    >;

    expect(insertManyMock).toHaveBeenCalledTimes(1);
    expect(insertedRows).toHaveLength(50);
    expect(insertedRows[0]).toEqual(
      expect.objectContaining({
        isActive: true,
        verifierAddresses: [
          "0x1111111111111111111111111111111111111111",
          "0x2222222222222222222222222222222222222222",
        ],
      })
    );
  });
});
