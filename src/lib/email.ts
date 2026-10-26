import "server-only";
import { z } from "zod";

const resendEndpoint = "https://api.resend.com/emails";

// HTTPS only, except loopback for local fixtures.
export function safeOrigin(value: string) {
  const url = new URL(value);
  const loopback =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !loopback))
    return null;
  return url;
}

// Shared Resend settings; null when sending is not configured.
export function resendConfig() {
  const result = z
    .object({
      apiKey: z.string().trim().min(1),
      from: z.email(),
      apiUrl: z.url(),
    })
    .safeParse({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM,
      // Only tests override the endpoint.
      apiUrl: process.env.RESEND_API_URL || resendEndpoint,
    });
  if (!result.success) return null;
  const api = safeOrigin(result.data.apiUrl);
  return api ? { ...result.data, apiUrl: api.href } : null;
}

export async function sendEmail(
  config: NonNullable<ReturnType<typeof resendConfig>>,
  message: {
    to: string;
    subject: string;
    text: string;
    idempotencyKey: string;
    attachments?: { filename: string; content: string }[];
  },
) {
  const response = await fetch(config.apiUrl, {
    method: "POST",
    // Never follow a redirect with the API key attached.
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      // A retry of the same message cannot send it twice.
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from: `RevDistrict website <${config.from}>`,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      attachments: message.attachments,
    }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof (body as { id?: unknown } | null)?.id !== "string")
    throw new Error("Email not accepted");
}
