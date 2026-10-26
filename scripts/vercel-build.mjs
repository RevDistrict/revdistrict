// Vercel runs the "vercel-build" script instead of "build". Check configuration, apply the schema, then build.
import { execFileSync } from "node:child_process";

const run = (command, args) =>
  execFileSync(command, args, { stdio: "inherit", env: process.env });

try {
  run(process.execPath, ["scripts/check-env.mjs"]);
  if (process.env.VERCEL_ENV === "production")
    run(process.execPath, ["--import", "tsx", "scripts/migrate.ts"]);
  run("npx", ["next", "build"]);
} catch {
  // The failing step already printed its own error.
  process.exit(1);
}
