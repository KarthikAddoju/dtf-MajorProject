# DACS Backend

Express + TypeScript API for the DACS demo.

## Purpose

- issues wallet-based JWT sessions from SIWE signatures
- stores submission, audit, institute, and disclosure data in MongoDB
- validates local blockchain readiness against the persistent Anvil devnet
- coordinates reviewer mint preparation, mint finalization, and revocation flows

## Runtime

- API default: `http://localhost:4000`
- Demo RPC: `http://127.0.0.1:8545`
- Expected local chain id: `31337`
- Recommended Node version for the demo: **20 or 22 LTS**

## Environment

Required local env values:

- `JWT_SECRET`
- `ADMIN_WALLET_ADDRESSES`
- `RPC_URL`
- `CHAIN_ID`
- `POCT_ADDRESS`
- `EDU_ADDRESS`
- `MINT_CONTROLLER_ADDRESS`
- `EVIDENCE_ENCRYPTION_KEY`

Optional:

- `MONGODB_URI`
- `FRONTEND_ORIGIN`
- `PINATA_JWT`
- `GEMINI_API_KEY`
- `PRIVATE_EVIDENCE_DIR`
- `REQUEST_BODY_LIMIT`

`cd contracts && npm run deploy:sync` refreshes the contract address and chain-id values in `backend/.env.local`.

## Commands

```bash
npm run dev
npm run typecheck
npm run test
npm run build
npm run start
```

## Route Index

- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `GET /api/auth/me`
- `POST /api/upload`
- `GET /api/evidence/:submissionId`
- `POST /api/evidence/:submissionId/analyse`
- `GET /api/institutes`
- `GET /api/institutes/manage`
- `GET /api/institutes/:slug/profile`
- `POST /api/institutes`
- `PATCH /api/institutes/:id`
- `GET /api/submissions`
- `GET /api/submissions/me`
- `GET /api/submissions/pending`
- `POST /api/submissions/:id/reject`
- `POST /api/reviews/reset-stale-mints`
- `POST /api/reviews/:submissionId/prepare-mint`
- `POST /api/reviews/:submissionId/finalize-mint`
- `GET /api/credentials/disclosures`
- `POST /api/credentials/:tokenId/revoke/finalize`
- `POST /api/credentials/:tokenId/disclosures`
- `GET /api/analytics/colleges`
- `GET /api/analytics/overview`
- `GET /api/verify/:tokenId`
- `GET /api/health`
- `GET /api/routes` (development only)

## Demo Diagnostics

- `GET /api/health` reports `observedChainId`, `expectedChainId`, `persistentDevnet`, and contract deployment readiness.
- `GET /api/routes` is available only when `NODE_ENV !== "production"`.
- Every response includes an `x-request-id` header to correlate browser activity with backend logs.
