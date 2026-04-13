import dotenv from "dotenv";

const fileEnv: Record<string, string> = {};

dotenv.config({ processEnv: fileEnv });
dotenv.config({ path: ".env.local", processEnv: fileEnv, override: true });

for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
