import { parseArgs } from "node:util";
import { readFile, stat } from "node:fs/promises";
import { downloadInventory, syncInventory } from "../src/lib/inventory-import";
import { MAX_INVENTORY_BYTES } from "../src/lib/dealr-inventory";

async function readLocalCsv(path: string) {
  const info = await stat(path);
  if (!info.isFile() || info.size > MAX_INVENTORY_BYTES)
    throw new Error("Inventory file is not a supported regular file.");
  return {
    text: await readFile(path, "utf8"),
    capturedAt: info.mtime.toISOString(),
  };
}

async function main() {
  const { values } = parseArgs({ options: { input: { type: "string" } } });
  const source = values.input
    ? await readLocalCsv(values.input)
    : await downloadInventory();
  console.log(JSON.stringify(await syncInventory(source)));
}

main().catch((error: unknown) => {
  // Node, SDK and database errors may include private hosts or paths; don't emit them.
  const message =
    error instanceof Error && !("code" in error)
      ? error.message
      : "Inventory import failed. Check database and file access.";
  console.error(message);
  process.exit(1);
});
