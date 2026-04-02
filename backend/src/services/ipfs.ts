import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { runtimeConfig } from "../config/runtime";

const IPFS_GATEWAY_BASE_URLS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://dweb.link/ipfs",
] as const;

export async function uploadToIPFS(filePath: string) {
  const pinataJwt = runtimeConfig.pinataJwt;

  if (!pinataJwt) {
    throw new Error("PINATA_JWT is not configured");
  }

  const data = new FormData();

  data.append("file", fs.createReadStream(filePath));

  const res = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    data,
    {
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
        ...data.getHeaders(),
      },
      maxBodyLength: Infinity,
      timeout: 60_000,
    }
  );

  return res.data.IpfsHash;
}

export async function uploadJsonToIPFS(payload: Record<string, unknown>) {
  const pinataJwt = runtimeConfig.pinataJwt;

  if (!pinataJwt) {
    throw new Error("PINATA_JWT is not configured");
  }

  const response = await axios.post(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      pinataContent: payload,
    },
    {
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
        "Content-Type": "application/json",
      },
      maxBodyLength: Infinity,
      timeout: 30_000,
    }
  );

  return response.data.IpfsHash as string;
}

export function buildIpfsGatewayUrl(cid: string) {
  return `${IPFS_GATEWAY_BASE_URLS[0]}/${cid}`;
}

export async function fetchJsonFromIPFS<T>(cid: string) {
  let lastError: unknown = null;

  for (const gatewayBaseUrl of IPFS_GATEWAY_BASE_URLS) {
    try {
      const response = await fetch(`${gatewayBaseUrl}/${cid}`, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        lastError = new Error(
          `IPFS gateway ${gatewayBaseUrl} responded with ${response.status}`
        );
        continue;
      }

      const rawBody = await response.text();

      try {
        return JSON.parse(rawBody) as T;
      } catch {
        lastError = new Error(
          `IPFS gateway ${gatewayBaseUrl} returned non-JSON content`
        );
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to fetch JSON from IPFS");
}
