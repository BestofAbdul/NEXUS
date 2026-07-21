import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const environment = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? "file:./dev.db",
};

const child = spawn(
  process.execPath,
  [prismaCli, ...process.argv.slice(2)],
  {
    env: environment,
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error("Unable to start Prisma CLI.", error);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
