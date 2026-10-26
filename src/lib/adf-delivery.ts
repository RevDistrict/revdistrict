import "server-only";
import { z } from "zod";
import { createAdfLead, dealrLeadRecipient, leadLabels } from "./adf";
import type { Lead } from "./leads";
import type { Vehicle } from "./vehicle";

const resendEndpoint = "https://api.resend.com/emails";

// HTTPS only, except loopback for local fixtures.
function safeOrigin(value: string) {
  const url = new URL(value);
  const loopback =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !loopback))
    return null;
  return url;
}

export function adfDeliveryConfig() {
  const result = z
    .object({
      apiKey: z.string().trim().min(1),
      from: z.email(),
      to: z.email(),
      siteUrl: z.url(),
      apiUrl: z.url(),
    })
    .safeParse({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM,
      to: process.env.ADF_LEAD_TO || dealrLeadRecipient,
      siteUrl: process.env.SITE_URL,
      // Only tests override the endpoint.
      apiUrl: process.env.RESEND_API_URL || resendEndpoint,
    });
  if (!result.success) return null;
  const site = safeOrigin(result.data.siteUrl);
  const api = safeOrigin(result.data.apiUrl);
  if (!site || !api) return null;
  return { ...result.data, siteUrl: site.origin, apiUrl: api.href };
}

export async function deliverAdfLead(
  config: NonNullable<ReturnType<typeof adfDeliveryConfig>>,
  lead: Lead,
  reference: string,
  vehicle?: Vehicle,
) {
  const content = createAdfLead(lead, {
    reference,
    submittedAt: new Date().toISOString(),
    siteUrl: config.siteUrl,
    recipient: config.to,
    vehicle,
  });
  const response = await fetch(config.apiUrl, {
    method: "POST",
    // Never follow a redirect with the API key attached.
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      // A retry of the same submission cannot send the lead twice.
      "Idempotency-Key": reference,
    },
    // Customer input never controls the sender, recipient or headers.
    body: JSON.stringify({
      from: `RevDistrict website <${config.from}>`,
      to: [config.to],
      subject: `RevDistrict — ${leadLabels[lead.intent]}`,
      text: `RevDistrict website: ${leadLabels[lead.intent]}\nReference: ${reference}\nThe attached ADF XML contains the customer's request.`,
      // Resend derives the MIME type from the .xml filename.
      attachments: [
        {
          filename: "lead.xml",
          content: Buffer.from(content, "utf8").toString("base64"),
        },
      ],
    }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof (body as { id?: unknown } | null)?.id !== "string")
    throw new Error("Lead email not accepted");
}
