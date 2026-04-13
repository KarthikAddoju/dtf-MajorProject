# DACS Contracts

Smart contracts and local-chain tooling for the DACS demo.

## Contracts

- `PoCT.sol` — soulbound proof-of-credential NFT
- `EDUToken.sol` — EDU reward token minted alongside approved credentials
- `MintController.sol` — reviewer/admin gatekeeper for dual-mint and revocation flows

## Roles

- `DEFAULT_ADMIN_ROLE` — AccessControl admin for role management
- `VERIFIER_ADMIN_ROLE` — manages institute verifier approvals
- `VERIFIER_ROLE` — allowed to call `dualMint`
- `REVOCATION_ROLE` — allowed to call `revokeCredential`

The demo uses institute-level verifier approvals in `MintController` as the source of truth for who can mint or revoke for a given institute.

## Local Devnet

DACS uses a persistent local Anvil devnet for the demo.

- RPC: `http://127.0.0.1:8545`
- Chain ID: `31337`
- State file: `contracts/.local/anvil-state.json`
- Demo mnemonic: Hardhat/Anvil default test mnemonic

Normal restart behavior:

- stop the devnet with `Ctrl-C`
- restart with `npm run devnet:start`
- keep the existing deployment and backend/frontend env files
- previously minted demo credentials remain valid

Fresh-chain reset behavior:

- run `npm run devnet:reset -- --yes`
- restart the devnet
- run `npm run deploy:sync`
- restart backend and frontend

## Commands

```bash
npm run compile
npm test
npm run devnet:start
npm run devnet:status
npm run devnet:reset -- --yes
npm run deploy:sync
```

## Deployment Flow

For a fresh local chain:

```bash
npm run devnet:start
npm run deploy:sync
```

`deploy:sync` deploys contracts to `localhost`, writes `contracts/deployments/localhost.json`, and syncs the backend/frontend `.env.local` files.

## Demo Safety Notes

- Use **Node 20 or 22 LTS** for the demo toolchain. Hardhat warns on Node 25.
- Use `Ctrl-C` for a clean devnet shutdown so Anvil can flush state to disk.
- Avoid `devnet:reset` unless you intentionally want a fresh chain.
- This pass keeps contract ABI and runtime behavior frozen for demo safety.
