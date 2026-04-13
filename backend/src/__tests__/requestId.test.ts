import { describe, expect, it, jest } from "@jest/globals";
import type { Request } from "express";
import { requestIdMiddleware } from "../lib/requestId";
import { createMockResponse } from "./routeTestUtils";

describe("requestIdMiddleware", () => {
  it("sets x-request-id on the response and stores it in res.locals", () => {
    const req = {} as Request;
    const res = createMockResponse();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.headers["x-request-id"]).toEqual(expect.any(String));
    expect(res.locals.requestId).toBe(res.headers["x-request-id"]);
  });
});
