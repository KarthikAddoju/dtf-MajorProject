import { describe, expect, it } from "@jest/globals";
import type { Request } from "express";
import introspectionRoutes from "../routes/introspection";
import { createMockResponse, getRouteHandler } from "./routeTestUtils";

describe("introspection route", () => {
  it("returns the static API route manifest in development-friendly form", async () => {
    const res = createMockResponse();
    const handler = getRouteHandler(introspectionRoutes, "get", "/");

    await handler({} as Request, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        routes: expect.arrayContaining([
          expect.objectContaining({
            method: "GET",
            path: "/api/health",
          }),
          expect.objectContaining({
            method: "GET",
            path: "/api/routes",
            devOnly: true,
          }),
        ]),
      })
    );
  });
});
