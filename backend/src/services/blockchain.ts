import { ethers } from "ethers";
import { runtimeConfig } from "../config/runtime";

export const provider = new ethers.JsonRpcProvider(
  runtimeConfig.rpcUrl
);

export const poctAddress = runtimeConfig.poctAddress;
export const eduAddress = runtimeConfig.eduAddress;
export const mintControllerAddress = runtimeConfig.mintControllerAddress;

export const mintControllerAbi = [
  "event DualMinted(address indexed student,uint256 indexed poctTokenId,uint256 eduAmount,address verifier,bytes32 instituteHash,bytes32 claimsRoot,string publicProofCid,uint64 expiresAt)",
  "event CredentialRevoked(uint256 indexed tokenId,address indexed revoker,bytes32 indexed reasonHash)",
  "function dualMint(address student,string publicProofCid,bytes32 claimsRoot,bytes32 instituteHash,uint256 eduAmount,uint64 expiresAt) external returns (uint256)",
  "function revokeCredential(uint256 tokenId,bytes32 reasonHash) external",
  "function instituteVerifiers(bytes32 instituteHash,address verifier) view returns (bool)",
  "function VERIFIER_ADMIN_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
] as const;

export const poctAbi = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner,uint256 index) view returns (uint256)",
  "function certificates(uint256 tokenId) view returns (string publicProofCid,bytes32 claimsRoot,bytes32 instituteHash,address verifier,uint64 issuedAt,uint64 expiresAt,bool revoked,bytes32 revocationReasonHash)",
  "function instituteHashOf(uint256 tokenId) view returns (bytes32)",
  "function credentialStatus(uint256 tokenId) view returns (uint8)",
] as const;

export const eduAbi = [
  "function balanceOf(address owner) view returns (uint256)",
] as const;

export const mintControllerReadContract = new ethers.Contract(
  mintControllerAddress,
  mintControllerAbi,
  provider
);

export const poctReadContract = new ethers.Contract(
  poctAddress,
  poctAbi,
  provider
);

export const eduReadContract = new ethers.Contract(
  eduAddress,
  eduAbi,
  provider
);

export function getVerificationStatusLabel(statusCode: bigint | number) {
  switch (Number(statusCode)) {
    case 2:
      return "revoked";
    case 1:
      return "expired";
    default:
      return "active";
  }
}

export function parseDualMintReceipt(receipt: ethers.TransactionReceipt) {
  const contractInterface = new ethers.Interface(mintControllerAbi);

  for (const log of receipt.logs) {
    try {
      const parsedLog = contractInterface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });

      if (parsedLog?.name === "DualMinted") {
        return {
          tokenId: parsedLog.args.poctTokenId.toString(),
          verifier: parsedLog.args.verifier.toString().toLowerCase(),
          instituteHash: parsedLog.args.instituteHash.toString(),
          claimsRoot: parsedLog.args.claimsRoot.toString(),
          publicProofCid: parsedLog.args.publicProofCid.toString(),
          expiresAt: Number(parsedLog.args.expiresAt),
          eduAmount: parsedLog.args.eduAmount.toString(),
        };
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  return null;
}

export function parseRevocationReceipt(receipt: ethers.TransactionReceipt) {
  const contractInterface = new ethers.Interface(mintControllerAbi);

  for (const log of receipt.logs) {
    try {
      const parsedLog = contractInterface.parseLog({
        topics: [...log.topics],
        data: log.data,
      });

      if (parsedLog?.name === "CredentialRevoked") {
        return {
          tokenId: parsedLog.args.tokenId.toString(),
          revoker: parsedLog.args.revoker.toString().toLowerCase(),
          reasonHash: parsedLog.args.reasonHash.toString(),
        };
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  return null;
}
