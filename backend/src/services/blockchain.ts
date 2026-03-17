import { ethers } from "ethers";

const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
const DEFAULT_BACKEND_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const DEFAULT_POCT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const DEFAULT_EDU_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const DEFAULT_MINT_CONTROLLER_ADDRESS =
  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

export const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL ?? DEFAULT_RPC_URL
);

const backendSignerPrivateKey =
  process.env.BACKEND_SIGNER_PRIVATE_KEY ?? DEFAULT_BACKEND_PRIVATE_KEY;

export const poctAddress = process.env.POCT_ADDRESS ?? DEFAULT_POCT_ADDRESS;
export const eduAddress = process.env.EDU_ADDRESS ?? DEFAULT_EDU_ADDRESS;
export const mintControllerAddress =
  process.env.MINT_CONTROLLER_ADDRESS ?? DEFAULT_MINT_CONTROLLER_ADDRESS;

export const wallet = new ethers.Wallet(backendSignerPrivateKey, provider);

export const mintControllerAbi = [
  "event DualMinted(address indexed student,uint256 indexed poctTokenId,uint256 eduAmount,address verifier)",
  "function dualMint(address student,string cid,uint256 eduAmount,address verifier,bytes signature) external",
  "function authorizedVerifiers(address verifier) view returns (bool)",
] as const;

export const poctAbi = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner,uint256 index) view returns (uint256)",
  "function certificates(uint256 tokenId) view returns (string cid,address verifier,uint256 issuedAt)",
] as const;

export const eduAbi = [
  "function balanceOf(address owner) view returns (uint256)",
] as const;

export const mintControllerContract = new ethers.Contract(
  mintControllerAddress,
  mintControllerAbi,
  wallet
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

export async function buildMintSignature(
  studentAddress: string,
  cid: string,
  eduAmountWei: bigint
) {
  const { chainId } = await provider.getNetwork();
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(
    ["address", "uint256", "address", "string", "uint256"],
    [mintControllerAddress, chainId, studentAddress, cid, eduAmountWei]
  );
  const messageHash = ethers.keccak256(encoded);

  return wallet.signMessage(ethers.getBytes(messageHash));
}

export async function isCurrentVerifierAuthorized() {
  return mintControllerContract.authorizedVerifiers(wallet.address);
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
        return parsedLog.args.poctTokenId.toString();
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  return null;
}
