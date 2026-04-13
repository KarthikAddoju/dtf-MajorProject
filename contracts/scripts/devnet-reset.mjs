import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.resolve(__dirname, "..");
const stateDirectory = path.join(contractsRoot, ".local");
const deploymentsDirectory = path.join(contractsRoot, "deployments");
const localhostDeploymentPath = path.join(deploymentsDirectory, "localhost.json");
const localhostEnvSnippetPath = path.join(deploymentsDirectory, "localhost.env");

async function removeIfPresent(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

async function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const confirmed = process.argv.includes("--yes");

  if (!confirmed) {
    console.log("⚠️  This will permanently delete the local devnet state and localhost deployment snapshots.");
    console.log("Re-run with `npm run devnet:reset -- --yes` to skip the countdown.");
    console.log("");

    for (let seconds = 5; seconds >= 1; seconds -= 1) {
      console.log(`Resetting in ${seconds}... Press Ctrl-C to abort.`);
      await wait(1000);
    }

    console.log("");
  }

  const [removedStateDirectory, removedDeploymentJson, removedDeploymentEnv] =
    await Promise.all([
      removeIfPresent(stateDirectory),
      removeIfPresent(localhostDeploymentPath),
      removeIfPresent(localhostEnvSnippetPath),
    ]);

  console.log("🧹 DACS local devnet reset complete.");
  console.log(
    `   Removed persisted state: ${removedStateDirectory ? "yes" : "already clean"}`
  );
  console.log(
    `   Removed deployments/localhost.json: ${removedDeploymentJson ? "yes" : "already clean"}`
  );
  console.log(
    `   Removed deployments/localhost.env: ${removedDeploymentEnv ? "yes" : "already clean"}`
  );
  console.log("");
  console.log("Next steps:");
  console.log("  1. Stop any running backend/frontend processes.");
  console.log("  2. Run `npm run devnet:start` in `contracts`.");
  console.log("  3. Run `npm run deploy:sync` to deploy fresh contracts and resync env files.");
  console.log("  4. Restart the backend, then the frontend.");
  console.log(
    "  5. Clear MetaMask activity and use `Reset stale mints` before reminting any records that belonged to the previous chain."
  );
}

main().catch((error) => {
  console.error("Failed to reset the local devnet:", error);
  process.exitCode = 1;
});
