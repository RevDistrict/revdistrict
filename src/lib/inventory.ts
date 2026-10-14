import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import preview from "@/data/inventory-preview.json";
import { inventorySchema, type Vehicle } from "./vehicle";
import { readInventorySnapshot } from "./inventory-file";
import { assertInventoryFresh } from "./dealr-inventory";
export const getInventory = cache(async () => {
  await connection();
  const endpoint = process.env.INVENTORY_FEED_URL;
  const file = process.env.INVENTORY_FILE_PATH;
  if (endpoint && file)
    throw new Error("Configure one inventory source: file or HTTPS feed.");
  if (file) {
    const data = await readInventorySnapshot(file);
    return {
      vehicles: data.vehicles.filter(
        (v) =>
          v.status === "active" || (data.isPreview && v.status === "preview"),
      ),
      isPreview: data.isPreview,
      updatedAt: data.capturedAt,
    };
  }
  if (!endpoint)
    return {
      vehicles: inventorySchema.parse(preview).vehicles,
      isPreview: true,
      updatedAt: preview.capturedAt,
    };
  if (!endpoint.startsWith("https://"))
    throw new Error("Inventory feed must use HTTPS.");
  const response = await fetch(endpoint, {
    headers: process.env.INVENTORY_FEED_TOKEN
      ? { Authorization: `Bearer ${process.env.INVENTORY_FEED_TOKEN}` }
      : {},
    next: { revalidate: 300, tags: ["inventory"] },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Inventory provider unavailable.");
  const payload = await response.text();
  if (payload.length > 10000000)
    throw new Error("Inventory feed exceeds the supported size.");
  const data = inventorySchema.parse(JSON.parse(payload));
  if (!data.isPreview) assertInventoryFresh(data.capturedAt);
  return {
    vehicles: data.vehicles.filter(
      (v: Vehicle) =>
        v.status === "active" || (data.isPreview && v.status === "preview"),
    ),
    isPreview: data.isPreview,
    updatedAt: data.capturedAt,
  };
});
