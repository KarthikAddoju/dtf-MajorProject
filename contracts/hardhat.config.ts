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

const config: HardhatUserConfig = {
  solidity: localSolcVersion,
};

export default config;
