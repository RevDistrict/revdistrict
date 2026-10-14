import { parseArgs } from "node:util";
import { readFile, open, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { Writable } from "node:stream";
import SftpClient from "ssh2-sftp-client";
import legacy from "../src/data/inventory-preview.json";
import {
  parseDealrInventory,
  MAX_INVENTORY_BYTES,
  assertInventoryFresh,
} from "../src/lib/dealr-inventory";
import {
  readInventoryFile,
  writeInventorySnapshot,
} from "../src/lib/inventory-file";

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing ${key}.`);
  return value;
}

async function withTimeout<T>(operation: Promise<T>, milliseconds: number) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("SFTP operation timed out.")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function downloadInventory() {
  const host = required("DEALR_SFTP_HOST");
  const username = required("DEALR_SFTP_USERNAME");
  const remotePath = required("DEALR_SFTP_PATH");
  const fingerprint = required("DEALR_SFTP_HOST_SHA256").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(fingerprint))
    throw new Error(
      "DEALR_SFTP_HOST_SHA256 must be a verified SHA256 hex fingerprint.",
    );
  const port = Number(process.env.DEALR_SFTP_PORT || 22);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid SFTP port.");
  const keyPath = process.env.DEALR_SFTP_PRIVATE_KEY_PATH;
  const password = process.env.DEALR_SFTP_PASSWORD;
  if (!keyPath && !password)
    throw new Error("Configure SFTP private-key or password authentication.");
  const privateKey = keyPath ? await readFile(keyPath) : undefined;
  const client = new SftpClient("inventory", {
    error: () =>
      console.error(
        "SFTP connection error; credentials and server details omitted.",
      ),
    end: () => {},
    close: () => {},
  });
  async function transfer() {
    await client.connect({
      host,
      port,
      username,
      ...(privateKey
        ? { privateKey, passphrase: process.env.DEALR_SFTP_PASSPHRASE }
        : { password }),
      hostHash: "sha256",
      hostVerifier: (hash: string) => hash === fingerprint,
      readyTimeout: 15_000,
    });
    const before = await client.stat(remotePath);
    if (!before.isFile || before.size > MAX_INVENTORY_BYTES)
      throw new Error("Unsupported inventory file.");
    const capturedAt = new Date(before.modifyTime).toISOString();
    assertInventoryFresh(capturedAt);
    let size = 0;
    const chunks: Buffer[] = [];
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        size += chunk.length;
        if (size > MAX_INVENTORY_BYTES)
          return callback(new Error("Inventory exceeds size limit."));
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    await client.get(remotePath, destination);
    const after = await client.stat(remotePath);
    if (
      before.size !== after.size ||
      before.modifyTime !== after.modifyTime ||
      size !== after.size
    )
      throw new Error("Inventory changed during download.");
    return { text: Buffer.concat(chunks).toString("utf8"), capturedAt };
  }
  try {
    return await withTimeout(transfer(), 45_000);
  } catch {
    throw new Error(
      "SFTP import failed. Verify connection settings, host fingerprint, file size/freshness and completed upload; the previous snapshot was retained.",
    );
  } finally {
    try {
      await withTimeout(client.end(), 5_000);
    } catch {
      throw new Error(
        "SFTP connection could not close cleanly; the previous snapshot was retained.",
      );
    }
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      output: { type: "string" },
      preview: { type: "boolean", default: false },
    },
  });
  const isPreview = values.preview;
  if (isPreview && !values.input)
    throw new Error("Preview imports require a local --input CSV.");
  if (!isPreview && process.env.DEALR_FEED_MODE !== "full")
    throw new Error(
      "Confirm complete active-inventory exports with dealr.cloud before setting DEALR_FEED_MODE=full. Delta feeds are not supported.",
    );
  const siteUrl = required("SITE_URL");
  const dealerId = required("DEALR_DEALER_ID");
  const output = resolve(values.output || required("INVENTORY_FILE_PATH"));
  if (values.input && resolve(values.input) === output)
    throw new Error("Input and output paths must differ.");
  const lockPath = `${output}.lock`;
  const lock = await open(lockPath, "wx", 0o600);
  try {
    const source = values.input
      ? await readInventoryFile(values.input)
      : await downloadInventory();
    const snapshot = parseDealrInventory(source.text, {
      capturedAt: source.capturedAt,
      siteUrl,
      dealerId,
      isPreview,
      legacyVehicles: legacy.vehicles,
    });
    await writeInventorySnapshot(output, snapshot);
    console.log(
      JSON.stringify({
        event: "inventory.imported",
        vehicles: snapshot.vehicles.length,
        capturedAt: snapshot.capturedAt,
        isPreview,
      }),
    );
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

main().catch((error: unknown) => {
  // Node filesystem and SSH errors may include private server paths; don't emit them.
  const message =
    error instanceof Error && !("code" in error)
      ? error.message
      : "Inventory import failed. Check file permissions and whether an import lock already exists.";
  console.error(message);
  // main's finally releases the lock first; exit also closes a stalled SSH socket.
  process.exit(1);
});
