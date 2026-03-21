import { Contract } from "ethers"
import { POCT_ADDRESS } from "@/lib/config"
import { getRpcProvider } from "@/lib/contracts/common"
import type { OnChainOwnedCertificate } from "@/lib/types"

export const POCT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function certificates(uint256 tokenId) view returns (string publicProofCid, bytes32 claimsRoot, bytes32 instituteHash, address verifier, uint64 issuedAt, uint64 expiresAt, bool revoked, bytes32 revocationReasonHash)",
  "function credentialStatus(uint256 tokenId) view returns (uint8)",
]

export function getPoctReadContract() {
  return new Contract(POCT_ADDRESS, POCT_ABI, getRpcProvider())
}

export async function getOwnedCertificates(
  ownerAddress: string
): Promise<OnChainOwnedCertificate[]> {
  const contract = getPoctReadContract()
  const balance = (await contract.balanceOf(ownerAddress)) as bigint
  const certificates: OnChainOwnedCertificate[] = []
  const totalCertificates = Number(balance)

  for (let index = 0; index < totalCertificates; index += 1) {
    const tokenId = (await contract.tokenOfOwnerByIndex(
      ownerAddress,
      index
    )) as bigint
    const certificate = (await contract.certificates(tokenId)) as {
      publicProofCid: string
      verifier: string
      issuedAt: bigint
      expiresAt: bigint
    }
    const verificationStatus = Number(
      (await contract.credentialStatus(tokenId)) as bigint
    )

    certificates.push({
      tokenId: tokenId.toString(),
      publicProofCid: certificate.publicProofCid,
      cid: certificate.publicProofCid,
      verifierAddress: certificate.verifier.toLowerCase(),
      issuedAt: new Date(Number(certificate.issuedAt) * 1000).toISOString(),
      expiresAt:
        Number(certificate.expiresAt) > 0
          ? new Date(Number(certificate.expiresAt) * 1000).toISOString()
          : null,
      verificationStatus:
        verificationStatus === 2
          ? "revoked"
          : verificationStatus === 1
            ? "expired"
            : "active",
    })
  }

  return certificates
}
