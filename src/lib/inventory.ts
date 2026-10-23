import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import preview from "@/data/inventory-preview.json";
import { inventorySchema, vehicleSchema, type Vehicle } from "./vehicle";
import { getPool } from "./db";
import { assertInventoryFresh } from "./dealr-inventory";
const fallback = () => ({
  vehicles: inventorySchema.parse(preview).vehicles,
  isPreview: true,
  updatedAt: preview.capturedAt,
});
export const getInventory = cache(async () => {
  await connection();
  const pool = getPool();
  if (!pool) return fallback();
  const [meta, rows] = await Promise.all([
    pool.query<{ captured_at: Date; is_preview: boolean }>(
      "SELECT captured_at, is_preview FROM inventory_meta",
    ),
    pool.query<{ data: unknown }>("SELECT data FROM vehicles ORDER BY id"),
  ]);
  if (!meta.rows[0]) return fallback();
  const { captured_at, is_preview } = meta.rows[0];
  const updatedAt = captured_at.toISOString();
  if (!is_preview) assertInventoryFresh(updatedAt);
  const vehicles: Vehicle[] = rows.rows
    .map((row) => vehicleSchema.parse(row.data))
    .filter(
      (v) => v.status === "active" || (is_preview && v.status === "preview"),
    );
  return { vehicles, isPreview: is_preview, updatedAt };
});
