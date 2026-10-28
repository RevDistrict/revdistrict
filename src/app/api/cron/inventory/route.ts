import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { downloadInventory, syncInventory } from "@/lib/inventory-import";
import { INVENTORY_META_TAG, INVENTORY_TAG } from "@/lib/inventory";
import { alertImportFailure } from "@/lib/inventory-alert";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; fail closed if it is unset.
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function GET(request: NextRequest) {
  if (!authorized(request)) return reply({ message: "Unauthorized" }, 401);
  let stage = "download";
  try {
    const source = await downloadInventory();
    stage = "parse and save";
    const { changed, ...result } = await syncInventory(source);
    // Visitors read from cache; only clear the vehicle copies when a car actually changed.
    revalidateTag(INVENTORY_META_TAG, { expire: 0 });
    if (changed) revalidateTag(INVENTORY_TAG, { expire: 0 });
    return reply(result, 200);
  } catch (error) {
    // Messages from our own code are safe; SDK and database errors are not.
    const safe = error instanceof Error && !("code" in error);
    console.error(safe ? error.message : "Inventory import failed.");
    await alertImportFailure(stage, error);
    return reply({ message: "Inventory import failed." }, 500);
  }
}
