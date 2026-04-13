import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.resolve(__dirname, "..");
const stateDirectory = path.join(contractsRoot, ".local");
const stateFilePath = path.join(stateDirectory, "anvil-state.json");
const deploymentsDirectory = path.join(contractsRoot, "deployments");
const localhostDeploymentPath = path.join(deploymentsDirectory, "localhost.json");

const devnetConfig = {
  host: "127.0.0.1",
  port: "8545",
  chainId: "31337",
  mnemonic: "test test test test test test test test test test test junk",
};

function printMissingAnvilMessage() {
  console.error("❌ `anvil` is not installed or not on your PATH.");
  console.error("Install Foundry/Anvil, then rerun `npm run devnet:start`.");
  console.error("The demo devnet now relies on Anvil for persistent local chain state.");
}

async function main() {
  await fs.mkdir(stateDirectory, { recursive: true });

  const [stateFileExists, deploymentExists] = await Promise.all([
    fs
      .access(stateFilePath)
      .then(() => true)
      .catch(() => false),
    fs
      .access(localhostDeploymentPath)
      .then(() => true)
      .catch(() => false),
  ]);

  console.log("🚀 Starting DACS persistent local devnet");
  console.log(`   RPC: http://${devnetConfig.host}:${devnetConfig.port}`);
  console.log(`   Chain ID: ${devnetConfig.chainId}`);
  console.log(`   State file: ${path.relative(contractsRoot, stateFilePath)}`);
  console.log(
    "⚠️  Use Ctrl-C for a clean shutdown. Force-killing the process can lose recent chain state."
  );

  if (stateFileExists) {
    console.log(
      "♻️  Restoring persisted devnet state. Previously minted credentials should remain valid."
    );
    if (deploymentExists) {
      console.log(
        "ℹ️  Existing localhost deployment snapshot detected. Restart the backend/frontend only unless you intentionally want a fresh chain."
      );
    }
  } else {
    console.log(
      "🆕 No persisted devnet state found. After the node is up, run `npm run deploy:sync` before starting the backend."
    );
  }

  const child = spawn(
    "anvil",
    [
      "--host",
      devnetConfig.host,
      "--port",
      devnetConfig.port,
      "--chain-id",
      devnetConfig.chainId,
      "--mnemonic",
      devnetConfig.mnemonic,
      "--state-interval",
      "60",
      "--state",
      stateFilePath,
    ],
    {
      stdio: "inherit",
      cwd: contractsRoot,
    }
  );

  child.on("error", (error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      printMissingAnvilMessage();
      process.exitCode = 1;
      return;
    }

    console.error("Failed to start Anvil:", error);
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("Failed to prepare the persistent devnet:", error);
  process.exitCode = 1;
});
