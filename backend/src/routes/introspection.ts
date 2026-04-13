import { Router } from "express";
import { sendSuccess } from "../lib/api";
import { apiRouteManifest } from "./manifest";

/**
 * Development-only route that lists the registered API surface for viva/demo diagnostics.
 */
const router = Router();

/**
 * Returns the static API route manifest used by the backend.
 *
 * Auth: public
 * Input: none
 * Errors: none
 */
router.get("/", (_req, res) => {
  return sendSuccess(res, {
    routes: apiRouteManifest,
  });
});

export default router;
