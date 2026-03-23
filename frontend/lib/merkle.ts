import { keccak256, toUtf8Bytes, solidityPackedKeccak256 } from "ethers"

// Exact port of backend/src/lib/merkle.ts — must stay in sync.
// Any deviation in hashing logic will produce wrong roots and break proof verification.

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right)
  )

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`
}

function hashLeaf(key: string, value: unknown): string {
  return keccak256(toUtf8Bytes(`${key}:${stableStringify(value)}`))
}

function hashPair(left: string, right: string): string {
  const [first, second] =
    left.toLowerCase() <= right.toLowerCase() ? [left, right] : [right, left]

  return solidityPackedKeccak256(["bytes32", "bytes32"], [first, second])
}

export function verifyMerkleProof(
  root: string,
  key: string,
  value: unknown,
  proof: string[]
): boolean {
  const startingHash = hashLeaf(key, value)
  const computedHash = proof.reduce(
    (currentHash, siblingHash) => hashPair(currentHash, siblingHash),
    startingHash
  )

  return computedHash.toLowerCase() === root.toLowerCase()
}
