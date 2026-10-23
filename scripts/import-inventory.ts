import { parseArgs } from "node:util";
import { readFile, stat } from "node:fs/promises";
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import pg from "pg";
import legacy from "../src/data/inventory-preview.json";
import {
  parseDealrInventory,
  MAX_INVENTORY_BYTES,
  assertInventoryFresh,
} from "../src/lib/dealr-inventory";
import type { inventorySchema } from "../src/lib/vehicle";
import type { z } from "zod";

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
          () => reject(new Error("S3 operation timed out.")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function readLocalCsv(path: string) {
  const info = await stat(path);
  if (!info.isFile() || info.size > MAX_INVENTORY_BYTES)
    throw new Error("Inventory file is not a supported regular file.");
  return {
    text: await readFile(path, "utf8"),
    capturedAt: info.mtime.toISOString(),
  };
}

async function downloadInventory() {
  const Bucket = required("S3_BUCKET_NAME");
  const Key = required("S3_INVENTORY_KEY");
  const s3 = new S3Client({});
  async function transfer() {
    const head = await s3.send(new HeadObjectCommand({ Bucket, Key }));
    if (
      !head.LastModified ||
      !head.ETag ||
      (head.ContentLength ?? 0) > MAX_INVENTORY_BYTES
    )
      throw new Error("Unsupported inventory file.");
    const capturedAt = head.LastModified.toISOString();
    assertInventoryFresh(capturedAt);
    // IfMatch fails the request if the object is replaced between HEAD and GET.
    const object = await s3.send(
      new GetObjectCommand({ Bucket, Key, IfMatch: head.ETag }),
    );
    const bytes = await object.Body!.transformToByteArray();
    if (bytes.length > MAX_INVENTORY_BYTES)
      throw new Error("Inventory exceeds size limit.");
    return { text: Buffer.from(bytes).toString("utf8"), capturedAt };
  }
  try {
    return await withTimeout(transfer(), 45_000);
  } catch {
    throw new Error(
      "S3 import failed. Verify bucket, key and credentials, file size/freshness and completed upload; the previous inventory was retained.",
    );
  } finally {
    s3.destroy();
  }
}

async function saveInventory(snapshot: z.infer<typeof inventorySchema>) {
  const client = new pg.Client({ connectionString: required("DATABASE_URL") });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7101)");
    const ids = snapshot.vehicles.map((v) => v.id);
    for (const v of snapshot.vehicles)
      await client.query(
        `INSERT INTO vehicles (id, status, data, updated_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (id) DO UPDATE SET status = $2, data = $3, updated_at = now()`,
        [v.id, v.status, v],
      );
    // The CSV is the only source of truth: anything it no longer lists is removed.
    await client.query("DELETE FROM vehicles WHERE NOT (id = ANY($1))", [ids]);
    await client.query(
      `INSERT INTO inventory_meta (singleton, captured_at, is_preview) VALUES (true, $1, $2)
       ON CONFLICT (singleton) DO UPDATE SET captured_at = $1, is_preview = $2`,
      [snapshot.capturedAt, snapshot.isPreview],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
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
  const source = values.input
    ? await readLocalCsv(values.input)
    : await downloadInventory();
  const snapshot = parseDealrInventory(source.text, {
    capturedAt: source.capturedAt,
    siteUrl,
    dealerId,
    isPreview,
    legacyVehicles: legacy.vehicles,
  });
  await saveInventory(snapshot);
  console.log(
    JSON.stringify({
      event: "inventory.imported",
      vehicles: snapshot.vehicles.length,
      capturedAt: snapshot.capturedAt,
      isPreview,
    }),
  );
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
