import type { Router } from "express";
import analyticsRoutes from "./analytics";
import authRoutes from "./auth";
import credentialRoutes from "./credentials";
import evidenceRoutes from "./evidence";
import healthRoutes from "./health";
import instituteRoutes from "./institutes";
import reviewRoutes from "./reviews";
import submissionRoutes from "./submissions";
import uploadRoutes from "./upload";
import verifyRoutes from "./verify";

/**
 * Static API registration metadata shared by startup wiring and the dev-only route index.
 */
export interface ApiRouteEntry {
  method: "GET" | "POST" | "PATCH";
  path: string;
  auth: "public" | "authenticated" | "admin" | "admin|verifier";
  summary: string;
  devOnly?: boolean;
}

interface ApiRouteModule {
  basePath: string;
  router: Router;
}

export const apiRouteModules: ApiRouteModule[] = [
  { basePath: "/api/auth", router: authRoutes },
  { basePath: "/api/upload", router: uploadRoutes },
  { basePath: "/api/evidence", router: evidenceRoutes },
  { basePath: "/api/institutes", router: instituteRoutes },
  { basePath: "/api/submissions", router: submissionRoutes },
  { basePath: "/api/reviews", router: reviewRoutes },
  { basePath: "/api/credentials", router: credentialRoutes },
  { basePath: "/api/analytics", router: analyticsRoutes },
  { basePath: "/api/verify", router: verifyRoutes },
  { basePath: "/api/health", router: healthRoutes },
];

export const apiRouteManifest: ApiRouteEntry[] = [
  { method: "POST", path: "/api/auth/challenge", auth: "public", summary: "Create a SIWE login challenge" },
  { method: "POST", path: "/api/auth/verify", auth: "public", summary: "Verify the SIWE signature and issue a JWT" },
  { method: "GET", path: "/api/auth/me", auth: "authenticated", summary: "Return the authenticated wallet profile" },
  { method: "POST", path: "/api/upload", auth: "authenticated", summary: "Upload a credential file and create a submission" },
  { method: "GET", path: "/api/evidence/:submissionId", auth: "authenticated", summary: "Download private evidence for an authorized submission" },
  { method: "POST", path: "/api/evidence/:submissionId/analyse", auth: "authenticated", summary: "Run evidence analysis for an authorized submission" },
  { method: "GET", path: "/api/institutes", auth: "public", summary: "List active institutes" },
  { method: "GET", path: "/api/institutes/manage", auth: "admin", summary: "List institutes for admin management" },
  { method: "GET", path: "/api/institutes/:slug/profile", auth: "public", summary: "Return the public institute profile and summary stats" },
  { method: "POST", path: "/api/institutes", auth: "admin", summary: "Create a new institute" },
  { method: "PATCH", path: "/api/institutes/:id", auth: "admin", summary: "Update institute metadata and reviewer addresses" },
  { method: "GET", path: "/api/submissions", auth: "admin|verifier", summary: "List submissions in reviewer scope" },
  { method: "GET", path: "/api/submissions/me", auth: "authenticated", summary: "List submissions for the authenticated student" },
  { method: "GET", path: "/api/submissions/pending", auth: "admin|verifier", summary: "List pending submissions in reviewer scope" },
  { method: "POST", path: "/api/submissions/:id/reject", auth: "admin|verifier", summary: "Reject a pending submission" },
  { method: "POST", path: "/api/reviews/reset-stale-mints", auth: "admin", summary: "Reset stale minted records after an explicit fresh-chain reset" },
  { method: "POST", path: "/api/reviews/:submissionId/prepare-mint", auth: "admin|verifier", summary: "Prepare the wallet-signed mint payload" },
  { method: "POST", path: "/api/reviews/:submissionId/finalize-mint", auth: "admin|verifier", summary: "Finalize a prepared on-chain mint" },
  { method: "GET", path: "/api/credentials/disclosures", auth: "authenticated", summary: "List saved disclosure packages for the authenticated student" },
  { method: "POST", path: "/api/credentials/:tokenId/revoke/finalize", auth: "admin|verifier", summary: "Finalize an on-chain credential revocation" },
  { method: "POST", path: "/api/credentials/:tokenId/disclosures", auth: "authenticated", summary: "Create a selective-disclosure package for a credential" },
  { method: "GET", path: "/api/analytics/colleges", auth: "public", summary: "Return institute analytics by college" },
  { method: "GET", path: "/api/analytics/overview", auth: "public", summary: "Return dashboard analytics totals" },
  { method: "GET", path: "/api/verify/:tokenId", auth: "public", summary: "Verify a credential token and return proof details" },
  { method: "GET", path: "/api/health", auth: "public", summary: "Return API, database, and blockchain readiness status" },
  { method: "GET", path: "/api/routes", auth: "public", summary: "List registered API routes in development", devOnly: true },
];
