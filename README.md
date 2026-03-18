# DACS

Decentralized Academic Credential System for issuing verifiable academic certificates as soulbound NFTs with EDU token rewards.

## Current Product Scope

Implemented in this codebase:
- Wallet sign-in with backend challenge/verify JWT auth
- Student drag-and-drop academic credential submission to Pinata IPFS
- MongoDB-backed submission lifecycle for `pending_review`, `rejected`, and `minted`
- Admin review console with approve/mint and reject flows
- Public certificate verification page by `tokenId` with QR sharing
- Student dashboard with EDU balance, owned credentials, and submission history
- Public college index showing total EDU minted per institute
- Hardhat deploy artifact export and env sync for backend/frontend
- Soulbound-like PoCT NFT transfer blocking after mint

Still intentionally out of scope for this version:
- Testnet or production deployment
- Revocation workflow
- Institute-specific admin roles
- Metadata JSON IPFS standardization
- Full event indexing or analytics pipeline

## Architecture

- `frontend`: Next.js app for student, admin, public verify, dashboard, and colleges pages
- `backend`: Express API for auth, uploads, minting, institute management, submissions, analytics, and verification
- `contracts`: Hardhat workspace for `PoCT`, `EDUToken`, and `MintController`
- `frontend_backup`: preserved older frontend snapshot, not part of the active product flow

System roles:
- MongoDB stores institute data and certificate workflow state
- IPFS stores uploaded credential evidence files
- Hardhat local chain stores PoCT ownership, verifier, timestamp, and EDU rewards

## Core Flow

1. Student connects MetaMask and signs in.
2. Student drags a credential evidence file into `/upload`, selects a college, chooses a credential type, and submits.
3. Backend uploads the file to Pinata IPFS and stores a `pending_review` submission in MongoDB.
4. Admin opens `/admin`, reviews the pending queue, and approves with an EDU amount or rejects with a note.
5. Backend mints a PoCT NFT plus EDU reward through `MintController`, parses the emitted event, and stores `tokenId` and `txHash`.
6. Student sees updated submissions and owned credentials in `/dashboard`.
7. Public users verify the credential on `/verify?tokenId=<id>` and can scan/share the QR code.
8. `/colleges` aggregates minted EDU totals by institute.

## Local Setup

### Prerequisites

- Node.js
- MongoDB running locally
- MetaMask installed
- Pinata JWT for IPFS upload

### 1. Install Dependencies

```bash
cd contracts && npm install
cd ../backend && npm install
cd ../frontend && npm install
```

### 2. Configure Backend Secrets

Create `backend/.env.local` from `backend/.env.example` and set at least:

```env
PINATA_JWT=your-pinata-jwt
JWT_SECRET=change-me
MONGODB_URI=mongodb://127.0.0.1:27017/dtf
```

### 3. Start Hardhat and Deploy Contracts

Terminal 1:

```bash
cd contracts
npx hardhat node
```

Terminal 2:

```bash
cd contracts
npm run deploy:local
npm run sync:env
```

`npm run sync:env` writes the latest contract addresses into:
- `backend/.env.local`
- `frontend/.env.local`

### 4. Start Backend and Frontend

Terminal 3:

```bash
cd backend
npm run dev
```

Terminal 4:

```bash
cd frontend
npm run dev
```

## Demo Runbook

Recommended submission demo sequence:

1. Show `/upload` and sign in with a student wallet.
2. Drag in a credential evidence file, choose a college and credential type, and submit.
3. Show the submission appear immediately in the student queue.
4. Switch to the admin wallet and open `/admin`.
5. Approve the pending submission with an EDU reward.
6. Show the returned token on `/dashboard`.
7. Open `/verify?tokenId=<id>` and show the QR code plus on-chain verification data.
8. Open `/colleges` and show the institute totals updated after mint.

## Environment Files

Backend example:
- `backend/.env.example`

Frontend example:
- `frontend/.env.example`

Important operational rule:
- Restarting Hardhat resets chain state, so redeploy and rerun `npm run sync:env` after every restart.

## Validation Commands

Contracts:

```bash
cd contracts
npm run compile
```

Backend:

```bash
cd backend
npm run typecheck
```

Frontend:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

## Key Routes

Backend:
- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `GET /api/auth/me`
- `POST /api/upload`
- `POST /api/mint`
- `GET /api/submissions/me`
- `GET /api/submissions/pending`
- `POST /api/submissions/:id/reject`
- `GET /api/institutes`
- `GET /api/institutes/manage`
- `POST /api/institutes`
- `PATCH /api/institutes/:id`
- `GET /api/analytics/colleges`
- `GET /api/verify/:tokenId`

Frontend:
- `/`
- `/upload`
- `/admin`
- `/dashboard`
- `/verify`
- `/colleges`

## Known Constraints

- This project is intentionally localhost-first for final demonstration reliability.
- Hardhat state is ephemeral.
- The public verify page is tokenId-first, not CID-first.
- Institute affiliation is stored off-chain in MongoDB.
