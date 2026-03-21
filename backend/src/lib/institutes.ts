import { isAddress, ethers } from "ethers";

export function normalizeWalletAddress(address: string) {
  return address.trim().toLowerCase();
}

export function assertWalletAddress(address: string) {
  if (!isAddress(address)) {
    throw new Error(`Invalid wallet address: ${address}`);
  }

  return normalizeWalletAddress(address);
}

export function uniqueWalletAddresses(addresses: string[]) {
  return [...new Set(addresses.map(assertWalletAddress))];
}

export function buildInstituteHash(shortCode: string) {
  return ethers.id(`DACS_INSTITUTE:${shortCode.trim().toUpperCase()}`);
}
