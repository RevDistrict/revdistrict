import "server-only";
import { z } from "zod";
import { createAdfLead, dealrLeadRecipient, leadLabels } from "./adf";
import { resendConfig, safeOrigin, sendEmail } from "./email";
import type { Lead } from "./leads";
import type { Vehicle } from "./vehicle";

export function adfDeliveryConfig() {
  const email = resendConfig();
  const result = z.object({ to: z.email(), siteUrl: z.url() }).safeParse({
    to: process.env.ADF_LEAD_TO || dealrLeadRecipient,
    siteUrl: process.env.SITE_URL,
  });
  if (!email || !result.success) return null;
  const site = safeOrigin(result.data.siteUrl);
  if (!site) return null;
  return { ...email, ...result.data, siteUrl: site.origin };
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
  // Customer input never controls the sender, recipient or headers.
  await sendEmail(config, {
    to: config.to,
    subject: `RevDistrict — ${leadLabels[lead.intent]}`,
    text: `RevDistrict website: ${leadLabels[lead.intent]}\nReference: ${reference}\nThe attached ADF XML contains the customer's request.`,
    // The lead reference makes a retry of the same submission idempotent.
    idempotencyKey: reference,
    // Resend derives the MIME type from the .xml filename.
    attachments: [
      {
        filename: "lead.xml",
        content: Buffer.from(content, "utf8").toString("base64"),
      },
    ],
  });
}
