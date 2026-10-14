import { NextResponse, type NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { leadSchema, rateLimit } from "@/lib/leads";
import { adfDeliveryConfig, deliverAdfLead } from "@/lib/adf-delivery";
import { getInventory } from "@/lib/inventory";
import type { Vehicle } from "@/lib/vehicle";
export const runtime = "nodejs";
const reply = (body: object, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: NextRequest) {
  const reference = randomUUID();
  const expectedOrigin = new URL(
    process.env.SITE_URL ||
      `${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`,
  ).origin;
  if (request.headers.get("origin") !== expectedOrigin)
    return reply(
      { message: "Please submit this form from the RevDistrict website." },
      403,
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return reply(
      {
        message:
          "Please enable JavaScript to use this form, or call (801) 906-8111.",
      },
      415,
    );
  if (Number(request.headers.get("content-length") || 0) > 16000)
    return reply(
      { message: "Your message is too long. Please shorten it and try again." },
      413,
    );
  const key = createHash("sha256")
    .update(
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local",
    )
    .digest("hex");
  if (!rateLimit(key))
    return reply(
      { message: "Please wait a minute before trying again, or call us." },
      429,
    );
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 16000)
      return reply({ message: "Your message is too long." }, 413);
    body = JSON.parse(raw);
  } catch {
    return reply(
      { message: "We couldn’t read the form. Please try again." },
      400,
    );
  }
  const result = leadSchema.safeParse(body);
  if (!result.success)
    return reply(
      {
        message:
          "Please check your contact information and complete all required fields.",
        fields: result.error.flatten().fieldErrors,
      },
      400,
    );
  if (result.data.website)
    return reply({ message: "This submission could not be accepted." }, 400);
  const delivery = adfDeliveryConfig();
  if (!delivery)
    return reply(
      {
        message:
          "Online messages are not available yet. Your message has not been sent. Please call or email the team below.",
        reference,
      },
      503,
    );
  try {
    let vehicle: Vehicle | undefined;
    if (result.data.vehicleId) {
      try {
        vehicle = (await getInventory()).vehicles.find(
          (v) => v.id === result.data.vehicleId,
        );
      } catch {
        // Preserve the inquiry if inventory is unavailable, with only the requested ID.
      }
    }
    await deliverAdfLead(delivery, result.data, reference, vehicle);
    return reply(
      {
        message:
          result.data.intent === "test-drive"
            ? "Your request is with the team. We’ll contact you to confirm the time."
            : "Your message is with the team. We’ll be in touch.",
        reference,
      },
      201,
    );
  } catch {
    console.error(JSON.stringify({ event: "lead.delivery_failed", reference }));
    return reply(
      {
        message:
          "We couldn’t confirm delivery. Please call the team before submitting again.",
        reference,
      },
      502,
    );
  }
}
