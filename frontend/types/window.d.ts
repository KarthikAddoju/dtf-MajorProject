import { Eip1193Provider } from "ethers";

interface WalletProvider extends Eip1193Provider {
  isMetaMask?: boolean;
  providers?: WalletProvider[];
}

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

export {};
