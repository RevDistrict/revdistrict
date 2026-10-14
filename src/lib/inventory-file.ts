import { open, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { inventorySchema } from "./vehicle";
import { assertInventoryFresh, MAX_INVENTORY_BYTES } from "./dealr-inventory";

export async function readInventoryFile(path: string) {
  const file = await open(path, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > MAX_INVENTORY_BYTES)
      throw new Error("Inventory file is not a supported regular file.");
    const buffer = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > MAX_INVENTORY_BYTES)
      throw new Error("Inventory file exceeds the supported size.");
    const after = await file.stat();
    if (
      stat.size !== after.size ||
      stat.mtimeMs !== after.mtimeMs ||
      size !== after.size
    )
      throw new Error(
        "Inventory file changed during reading. Retry after upload finishes.",
      );
    return {
      text: buffer.subarray(0, size).toString("utf8"),
      capturedAt: stat.mtime.toISOString(),
    };
  } finally {
    await file.close();
  }
}

export async function readInventorySnapshot(path: string) {
  const { text } = await readInventoryFile(path);
  const result = inventorySchema.safeParse(JSON.parse(text));
  if (!result.success) throw new Error("Inventory snapshot is invalid.");
  if (!result.data.isPreview) assertInventoryFresh(result.data.capturedAt);
  return result.data;
}

export async function writeInventorySnapshot(path: string, data: unknown) {
  const snapshot = inventorySchema.parse(data);
  const payload = JSON.stringify(snapshot);
  if (Buffer.byteLength(payload) > MAX_INVENTORY_BYTES)
    throw new Error("Normalized inventory exceeds the supported size.");
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, payload, { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
