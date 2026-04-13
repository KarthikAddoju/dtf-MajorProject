import { request } from "node:http";

const RPC_URL = "http://127.0.0.1:8545";

function rpcCall(method, id) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: [],
    });

    const req = request(
      RPC_URL,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let responseBody = "";

        res.on("data", (chunk) => {
          responseBody += chunk;
        });

        res.on("end", () => {
          try {
            const parsed = JSON.parse(responseBody);

            if (parsed.error) {
              reject(new Error(parsed.error.message ?? "Unknown RPC error"));
              return;
            }

            resolve(parsed.result);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  try {
    const [chainIdHex, blockNumberHex] = await Promise.all([
      rpcCall("eth_chainId", 1),
      rpcCall("eth_blockNumber", 2),
    ]);

    const chainId = Number.parseInt(chainIdHex, 16);
    const blockNumber = Number.parseInt(blockNumberHex, 16);

    console.log("DACS devnet status");
    console.log(`  RPC: ${RPC_URL}`);
    console.log(`  Chain ID: ${chainId} (${chainIdHex})`);
    console.log(`  Block number: ${blockNumber} (${blockNumberHex})`);
  } catch (error) {
    console.error("❌ Could not reach the local devnet at http://127.0.0.1:8545");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

main();
