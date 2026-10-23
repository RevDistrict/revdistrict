import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import pg from "pg";
import legacy from "../data/inventory-preview.json";
import {
  parseDealrInventory,
  MAX_INVENTORY_BYTES,
  assertInventoryFresh,
} from "./dealr-inventory";
import type { inventorySchema } from "./vehicle";
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

export async function downloadInventory() {
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
      `INSERT INTO inventory_meta (singleton, captured_at) VALUES (true, $1)
       ON CONFLICT (singleton) DO UPDATE SET captured_at = $1`,
      [snapshot.capturedAt],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

export async function syncInventory(source: {
  text: string;
  capturedAt: string;
}) {
  if (process.env.DEALR_FEED_MODE !== "full")
    throw new Error(
      "Confirm complete active-inventory exports with dealr.cloud before setting DEALR_FEED_MODE=full. Delta feeds are not supported.",
    );
  const snapshot = parseDealrInventory(source.text, {
    capturedAt: source.capturedAt,
    siteUrl: required("SITE_URL"),
    dealerId: required("DEALR_DEALER_ID"),
    legacyVehicles: legacy.vehicles,
  });
  await saveInventory(snapshot);
  return {
    event: "inventory.imported",
    vehicles: snapshot.vehicles.length,
    capturedAt: snapshot.capturedAt,
  };
}
