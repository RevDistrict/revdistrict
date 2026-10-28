import "server-only";
import { connection } from "next/server";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { vehicleSchema } from "./vehicle";
import { getPool } from "./db";
import { assertInventoryFresh } from "./dealr-inventory";

// Everything read from Postgres is cached across requests and cleared by the import cron
// (`revalidateTag`), so visitors only reach the database after the inventory changes.
export const INVENTORY_TAG = "inventory";
export const INVENTORY_META_TAG = "inventory-meta";

function pool() {
  const db = getPool();
  if (!db) throw new Error("RD_DATABASE_URL is not configured.");
  return db;
}

const getCapturedAt = unstable_cache(
  async () => {
    const { rows } = await pool().query<{ captured_at: Date }>(
      "SELECT captured_at FROM inventory_meta",
    );
    if (!rows[0]) throw new Error("Inventory has not been imported yet.");
    return rows[0].captured_at.toISOString();
  },
  ["inventory-meta"],
  { tags: [INVENTORY_META_TAG], revalidate: 3600 },
);

const summarySchema = vehicleSchema
  .omit({ description: true, equipment: true })
  .extend({ photoCount: z.number().int() });

// The list pages only show the first photo and no long text, so the database trims them.
const getSummaries = unstable_cache(
  async () => {
    const { rows } = await pool().query<{ data: unknown }>(
      `SELECT (data - 'description' - 'equipment' - 'images')
         || jsonb_build_object(
              'images', CASE WHEN jsonb_array_length(data->'images') > 0
                             THEN jsonb_build_array(data->'images'->0) ELSE '[]'::jsonb END,
              'photoCount', jsonb_array_length(data->'images')
            ) AS data
       FROM vehicles ORDER BY id`,
    );
    return rows.map((row) => ({
      ...summarySchema.parse(row.data),
      description: [] as string[],
      equipment: {} as Record<string, string[]>,
    }));
  },
  ["inventory-summaries"],
  { tags: [INVENTORY_TAG], revalidate: 86400 },
);

const getFullVehicle = unstable_cache(
  async (id: string) => {
    const { rows } = await pool().query<{ data: unknown }>(
      "SELECT data FROM vehicles WHERE id = $1",
      [id],
    );
    return rows[0] ? vehicleSchema.parse(rows[0].data) : null;
  },
  ["inventory-vehicle"],
  { tags: [INVENTORY_TAG], revalidate: 86400 },
);

export async function getVehicleSummaries() {
  await connection();
  const updatedAt = await getCapturedAt();
  assertInventoryFresh(updatedAt);
  return { vehicles: await getSummaries(), updatedAt };
}

export async function getVehicle(id: string) {
  const { vehicles } = await getVehicleSummaries();
  // Unknown ids never reach the database or add cache entries.
  if (!vehicles.some((v) => v.id === id)) return undefined;
  return (await getFullVehicle(id)) ?? undefined;
}
