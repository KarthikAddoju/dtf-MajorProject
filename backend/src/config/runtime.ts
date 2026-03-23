import { isAddress } from "ethers";

function normalizeAddress(address: string) {
  return address.trim().toLowerCase();
}

function readEnv(name: string) {
  return process.env[name]?.trim();
}

function requireEnv(name: string) {
  const value = readEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function requireNonPlaceholderEnv(name: string, placeholderValues: string[] = []) {
  const value = requireEnv(name);

  if (placeholderValues.includes(value)) {
    throw new Error(
      `Environment variable ${name} must be configured with a real value`
    );
  }

  return value;
}

function requireAddressEnv(name: string) {
  const value = requireEnv(name);

  if (!isAddress(value)) {
    throw new Error(`Environment variable ${name} must be a valid EVM address`);
  }

  return normalizeAddress(value);
}

function parsePort(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  return parsed;
}

function parseAddressList(keys: string[]) {
  const rawValue =
    keys.map((key) => readEnv(key)).find((value) => typeof value === "string") ??
    "";

  if (!rawValue) {
    return [];
  }

  return [...new Set(rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (!isAddress(entry)) {
        throw new Error(`Invalid address "${entry}" in ${keys.join(" / ")}`);
      }

      return normalizeAddress(entry);
    }))];
}

function parseEvidenceEncryptionKey() {
  const rawValue = requireEnv("EVIDENCE_ENCRYPTION_KEY").replace(/^0x/i, "");

  if (!/^[0-9a-fA-F]{64}$/.test(rawValue)) {
    throw new Error(
      "EVIDENCE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    );
  }

  return Buffer.from(rawValue, "hex");
}

const adminWalletAddresses = parseAddressList([
  "ADMIN_WALLET_ADDRESSES",
  "ADMIN_WALLET_ADDRESS",
]);

if (adminWalletAddresses.length === 0) {
  throw new Error(
    "At least one admin wallet address must be configured via ADMIN_WALLET_ADDRESSES or ADMIN_WALLET_ADDRESS"
  );
}

const verifierWalletAddresses = parseAddressList(["VERIFIER_WALLET_ADDRESSES"]);

export const runtimeConfig = {
  port: parsePort(readEnv("PORT"), 4000),
  mongodbUri: readEnv("MONGODB_URI") ?? "mongodb://127.0.0.1:27017/dtf",
  frontendOrigin: readEnv("FRONTEND_ORIGIN") ?? "http://localhost:3000",
  jwtSecret: requireNonPlaceholderEnv("JWT_SECRET", ["change-me", "supersecret"]),
  adminWalletAddresses,
  verifierWalletAddresses,
  bootstrapVerifierAddresses: [
    ...new Set([...adminWalletAddresses, ...verifierWalletAddresses]),
  ],
  rpcUrl: requireEnv("RPC_URL"),
  poctAddress: requireAddressEnv("POCT_ADDRESS"),
  eduAddress: requireAddressEnv("EDU_ADDRESS"),
  mintControllerAddress: requireAddressEnv("MINT_CONTROLLER_ADDRESS"),
  pinataJwt:
    readEnv("PINATA_JWT") && readEnv("PINATA_JWT") !== "your-pinata-jwt"
      ? readEnv("PINATA_JWT")
      : null,
  evidenceEncryptionKey: parseEvidenceEncryptionKey(),
  privateEvidenceDir: readEnv("PRIVATE_EVIDENCE_DIR") ?? "private-evidence",
  requestBodyLimit: readEnv("REQUEST_BODY_LIMIT") ?? "1mb",
  seedDefaultInstitutes: readEnv("SEED_DEFAULT_INSTITUTES") !== "false",
  geminiApiKey: readEnv("GEMINI_API_KEY") ?? null,
} as const;

export function isAdminWallet(address: string) {
  return runtimeConfig.adminWalletAddresses.includes(normalizeAddress(address));
}

export function isBootstrapVerifierWallet(address: string) {
  return runtimeConfig.bootstrapVerifierAddresses.includes(
    normalizeAddress(address)
  );
}
