"use client"

import { Contract, type JsonRpcSigner, type TransactionResponse } from "ethers"
import { MINT_CONTROLLER_ADDRESS } from "@/lib/config"
import { getRpcProvider } from "@/lib/contracts/common"

export const MINT_CONTROLLER_ABI = [
  "function dualMint(address student,string publicProofCid,bytes32 claimsRoot,bytes32 instituteHash,uint256 eduAmount,uint64 expiresAt) external returns (uint256)",
  "function revokeCredential(uint256 tokenId,bytes32 reasonHash) external",
  "function instituteVerifiers(bytes32 instituteHash,address verifier) view returns (bool)",
  "function setInstituteVerifier(bytes32 instituteHash,address verifier,bool approved) external",
  "function VERIFIER_ADMIN_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
]

export function getMintControllerReadContract() {
  return new Contract(MINT_CONTROLLER_ADDRESS, MINT_CONTROLLER_ABI, getRpcProvider())
}

export function getMintControllerWriteContract(signer: JsonRpcSigner) {
  return new Contract(MINT_CONTROLLER_ADDRESS, MINT_CONTROLLER_ABI, signer)
}

export async function ensureInstituteVerifierAuthorization(
  signer: JsonRpcSigner,
  instituteHash: string
) {
  const contract = getMintControllerWriteContract(signer)
  const signerAddress = (await signer.getAddress()).toLowerCase()
  const alreadyAuthorized = (await contract.instituteVerifiers(
    instituteHash,
    signerAddress
  )) as boolean

  if (alreadyAuthorized) {
    return null
  }

  const verifierAdminRole = (await contract.VERIFIER_ADMIN_ROLE()) as string
  const canGrant = (await contract.hasRole(verifierAdminRole, signerAddress)) as boolean

  if (!canGrant) {
    throw new Error(
      "This wallet is not authorized for the selected institute and cannot self-authorize on-chain."
    )
  }

  const tx = (await contract.setInstituteVerifier(
    instituteHash,
    signerAddress,
    true
  )) as TransactionResponse

  await tx.wait()
  return tx.hash
}

export async function submitDualMint(
  signer: JsonRpcSigner,
  input: {
    studentAddress: string
    publicProofCid: string
    claimsRoot: string
    instituteHash: string
    eduAmountWei: string
    expiresAt: number
  }
) {
  const contract = getMintControllerWriteContract(signer)

  return (await contract.dualMint(
    input.studentAddress,
    input.publicProofCid,
    input.claimsRoot,
    input.instituteHash,
    input.eduAmountWei,
    input.expiresAt
  )) as TransactionResponse
}

export async function submitCredentialRevocation(
  signer: JsonRpcSigner,
  tokenId: string,
  reasonHash: string
) {
  const contract = getMintControllerWriteContract(signer)

  return (await contract.revokeCredential(tokenId, reasonHash)) as TransactionResponse
}
