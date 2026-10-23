import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { vehicleSchema } from "./vehicle";
import { getPool } from "./db";
import { assertInventoryFresh } from "./dealr-inventory";
export const getInventory = cache(async () => {
  await connection();
  const pool = getPool();
  if (!pool) throw new Error("DATABASE_URL is not configured.");
  const [meta, rows] = await Promise.all([
    pool.query<{ captured_at: Date }>("SELECT captured_at FROM inventory_meta"),
    pool.query<{ data: unknown }>("SELECT data FROM vehicles ORDER BY id"),
  ]);
  if (!meta.rows[0]) throw new Error("Inventory has not been imported yet.");
  const updatedAt = meta.rows[0].captured_at.toISOString();
  assertInventoryFresh(updatedAt);
  return {
    vehicles: rows.rows.map((row) => vehicleSchema.parse(row.data)),
    updatedAt,
  };
});
