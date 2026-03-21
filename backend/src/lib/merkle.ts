import { ethers } from "ethers";

export interface MerkleLeaf {
  key: string;
  value: unknown;
  hash: string;
}

export interface MerkleTreeResult {
  root: string;
  leaves: MerkleLeaf[];
  proofs: Record<string, string[]>;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right)
  );

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function hashLeaf(key: string, value: unknown) {
  return ethers.keccak256(
    ethers.toUtf8Bytes(`${key}:${stableStringify(value)}`)
  );
}

function hashPair(left: string, right: string) {
  const [first, second] =
    left.toLowerCase() <= right.toLowerCase() ? [left, right] : [right, left];

  return ethers.solidityPackedKeccak256(["bytes32", "bytes32"], [first, second]);
}

export function buildMerkleTree(claims: Record<string, unknown>): MerkleTreeResult {
  const leaves = Object.entries(claims)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => ({
      key,
      value,
      hash: hashLeaf(key, value),
    }));

  if (leaves.length === 0) {
    throw new Error("Cannot build a Merkle tree from an empty claim set");
  }

  const layers: string[][] = [leaves.map((leaf) => leaf.hash)];

  while (layers[layers.length - 1].length > 1) {
    const currentLayer = layers[layers.length - 1];
    const nextLayer: string[] = [];

    for (let index = 0; index < currentLayer.length; index += 2) {
      const left = currentLayer[index];
      const right = currentLayer[index + 1] ?? currentLayer[index];
      nextLayer.push(hashPair(left, right));
    }

    layers.push(nextLayer);
  }

  const proofs: Record<string, string[]> = {};

  leaves.forEach((leaf, leafIndex) => {
    const proof: string[] = [];
    let currentIndex = leafIndex;

    for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
      const layer = layers[layerIndex];
      const pairIndex =
        currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
      const pairHash = layer[pairIndex] ?? layer[currentIndex];

      proof.push(pairHash);
      currentIndex = Math.floor(currentIndex / 2);
    }

    proofs[leaf.key] = proof;
  });

  return {
    root: layers[layers.length - 1][0],
    leaves,
    proofs,
  };
}

export function verifyMerkleProof(
  root: string,
  key: string,
  value: unknown,
  proof: string[]
) {
  const startingHash = hashLeaf(key, value);
  const computedHash = proof.reduce(
    (currentHash, siblingHash) => hashPair(currentHash, siblingHash),
    startingHash
  );

  return computedHash.toLowerCase() === root.toLowerCase();
}
