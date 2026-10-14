import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
import { createAdfLead, dealrLeadRecipient, leadLabels } from "./adf";
import type { Lead } from "./leads";
import type { Vehicle } from "./vehicle";

export function adfDeliveryConfig() {
  const result = z
    .object({
      host: z
        .string()
        .trim()
        .min(1)
        .max(253)
        .regex(/^[a-zA-Z0-9.:-]+$/),
      port: z.coerce.number().int().min(1).max(65535),
      user: z.string().min(1),
      password: z.string().min(1),
      from: z.email(),
      to: z.email(),
      siteUrl: z.url(),
    })
    .safeParse({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || "587",
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM,
      to: process.env.ADF_LEAD_TO || dealrLeadRecipient,
      siteUrl: process.env.SITE_URL,
    });
  if (!result.success) return null;
  const url = new URL(result.data.siteUrl);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    return null;
  return { ...result.data, siteUrl: url.origin };
}

export async function deliverAdfLead(
  config: NonNullable<ReturnType<typeof adfDeliveryConfig>>,
  lead: Lead,
  reference: string,
  vehicle?: Vehicle,
) {
  const submittedAt = new Date().toISOString();
  const content = createAdfLead(lead, {
    reference,
    submittedAt,
    siteUrl: config.siteUrl,
    recipient: config.to,
    vehicle,
  });
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: true,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    auth: { user: config.user, pass: config.password },
    forceAuth: true,
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    dnsTimeout: 5000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });
  try {
    const info = await transport.sendMail({
      from: { name: "RevDistrict website", address: config.from },
      to: config.to,
      // Use the verified sender for bounces; customer input never controls recipients or headers.
      subject: `RevDistrict — ${leadLabels[lead.intent]}`,
      messageId: `<${reference}@${config.from.split("@")[1]}>`,
      text: `RevDistrict website: ${leadLabels[lead.intent]}\nReference: ${reference}\nThe attached ADF XML contains the customer's request.`,
      attachments: [
        {
          filename: "lead.xml",
          content,
          contentType: "application/xml; charset=utf-8",
          contentTransferEncoding: "base64",
        },
      ],
    });
    if (
      !info.accepted.some(
        (address) => address.toLowerCase() === config.to.toLowerCase(),
      ) ||
      info.rejected.length
    ) {
      throw new Error("Lead email not accepted");
    }
  } finally {
    transport.close();
  }
}
