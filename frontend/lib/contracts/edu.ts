import { Contract, formatUnits } from "ethers"
import { EDU_ADDRESS } from "@/lib/config"
import { getRpcProvider } from "@/lib/contracts/common"

export const EDU_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
]

export function getEduReadContract() {
  return new Contract(EDU_ADDRESS, EDU_ABI, getRpcProvider())
}

export async function getEduBalance(address: string) {
  const balance = (await getEduReadContract().balanceOf(address)) as bigint

  return {
    raw: balance,
    formatted: formatUnits(balance, 18),
  }
}
