import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomUUID,
  randomBytes,
} from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { runtimeConfig } from "../config/runtime";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function resolveEvidencePath(privateEvidenceRef: string) {
  return path.join(runtimeConfig.privateEvidenceDir, privateEvidenceRef);
}

async function ensureEvidenceDirectory() {
  await fs.mkdir(runtimeConfig.privateEvidenceDir, { recursive: true, mode: 0o700 });
}

export async function loadEvidenceBuffer(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const evidenceHash = `sha256:${createHash("sha256").update(buffer).digest("hex")}`;

  return {
    buffer,
    evidenceHash,
  };
}

export async function storeEncryptedEvidenceBuffer(buffer: Buffer) {
  await ensureEvidenceDirectory();

  const privateEvidenceRef = `${randomUUID()}.bin`;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(
    "aes-256-gcm",
    runtimeConfig.evidenceEncryptionKey,
    iv
  );
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]);

  await fs.writeFile(resolveEvidencePath(privateEvidenceRef), payload, {
    mode: 0o600,
  });

  return {
    privateEvidenceRef,
  };
}

export async function readEncryptedEvidence(privateEvidenceRef: string) {
  const payload = await fs.readFile(resolveEvidencePath(privateEvidenceRef));
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    runtimeConfig.evidenceEncryptionKey,
    iv
  );

  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
