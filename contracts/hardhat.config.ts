import "@nomicfoundation/hardhat-toolbox";
import { subtask, type HardhatUserConfig } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";

const localSolcVersion = "0.8.26";
const localSolcLongVersion = require("solc").version();
const localSolcJsPath = require.resolve("solc/soljson.js");

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(
  async ({ solcVersion }, _hre, runSuper) => {
    if (solcVersion === localSolcVersion) {
      return {
        compilerPath: localSolcJsPath,
        isSolcJs: true,
        version: localSolcVersion,
        longVersion: localSolcLongVersion,
      };
    }

    return runSuper();
  }
);

import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";

const config: HardhatUserConfig = {
  solidity: localSolcVersion,
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: [PRIVATE_KEY],
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || "",
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
