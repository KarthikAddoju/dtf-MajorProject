import { Contract } from "ethers"
import { POCT_ADDRESS } from "@/lib/config"
import { getRpcProvider } from "@/lib/contracts/common"
import type { OnChainOwnedCertificate } from "@/lib/types"

export const POCT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function certificates(uint256 tokenId) view returns (string cid, address verifier, uint256 issuedAt)",
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
      cid: string
      verifier: string
      issuedAt: bigint
    }

    certificates.push({
      tokenId: tokenId.toString(),
      cid: certificate.cid,
      verifierAddress: certificate.verifier.toLowerCase(),
      issuedAt: new Date(Number(certificate.issuedAt) * 1000).toISOString(),
    })
  }

  return certificates
}
