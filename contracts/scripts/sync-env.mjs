import fs from "node:fs/promises";
import path from "node:path";

const networkName = process.argv[2] ?? "localhost";
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const deploymentFilePath = path.join(repoRoot, "contracts", "deployments", `${networkName}.json`);

async function readDeployment() {
  const fileContents = await fs.readFile(deploymentFilePath, "utf8");
  return JSON.parse(fileContents);
}

function upsertEnvContent(existingContent, values, keysToRemove = []) {
  const lines = existingContent.split(/\r?\n/);
  const nextLines = lines.filter((line) => {
    if (!line.trim()) {
      return true;
    }

    return !keysToRemove.some((key) => line.startsWith(`${key}=`));
  });

  for (const [key, value] of Object.entries(values)) {
    const nextEntry = `${key}=${value}`;
    const existingIndex = nextLines.findIndex((line) => line.startsWith(`${key}=`));

    if (existingIndex >= 0) {
      nextLines[existingIndex] = nextEntry;
    } else {
      nextLines.push(nextEntry);
    }
  }

  return `${nextLines.filter(Boolean).join("\n")}\n`;
}

async function ensureEnvFile(filePath, exampleFilePath, values, keysToRemove = []) {
  let existingContent = "";

  try {
    existingContent = await fs.readFile(filePath, "utf8");
  } catch {
    try {
      existingContent = await fs.readFile(exampleFilePath, "utf8");
    } catch {
      existingContent = "";
    }
  }

  const nextContent = upsertEnvContent(existingContent, values, keysToRemove);
  await fs.writeFile(filePath, nextContent, "utf8");
  console.log(`Synced ${path.relative(repoRoot, filePath)}`);
}

async function main() {
  const deployment = await readDeployment();

  await ensureEnvFile(
    path.join(repoRoot, "backend", ".env.local"),
    path.join(repoRoot, "backend", ".env.example"),
    {
      RPC_URL: "http://127.0.0.1:8545",
      ADMIN_WALLET_ADDRESSES: deployment.admin ?? deployment.deployer,
      POCT_ADDRESS: deployment.poctAddress,
      EDU_ADDRESS: deployment.eduAddress,
      MINT_CONTROLLER_ADDRESS: deployment.mintControllerAddress,
    },
    ["ADMIN_WALLET_ADDRESS", "BACKEND_SIGNER_PRIVATE_KEY"]
  );

  await ensureEnvFile(
    path.join(repoRoot, "frontend", ".env.local"),
    path.join(repoRoot, "frontend", ".env.example"),
    {
      NEXT_PUBLIC_BACKEND_URL: "http://localhost:4000",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:8545",
      NEXT_PUBLIC_CHAIN_ID: String(deployment.chainId ?? 31337),
      NEXT_PUBLIC_POCT_ADDRESS: deployment.poctAddress,
      NEXT_PUBLIC_EDU_ADDRESS: deployment.eduAddress,
      NEXT_PUBLIC_MINT_CONTROLLER_ADDRESS: deployment.mintControllerAddress,
    }
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
