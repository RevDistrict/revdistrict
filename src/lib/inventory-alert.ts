import "server-only";
import { z } from "zod";
import { resendConfig, sendEmail } from "./email";

// Emails EMERGENCY_EMAIL when a scheduled import fails. Never throws: the alert must not mask the failure.
export async function alertImportFailure(stage: string, error: unknown) {
  try {
    const to = z.email().safeParse(process.env.EMERGENCY_EMAIL);
    const config = resendConfig();
    if (!to.success || !config) {
      console.error(
        "Import failure alert not sent: EMERGENCY_EMAIL or Resend is not configured.",
      );
      return;
    }
    // Our own errors carry no secrets; SDK and database errors can, so send only their name and code.
    const detail =
      error instanceof Error && !("code" in error)
        ? error.message
        : `${error instanceof Error ? error.name : "Unknown error"}${
            (error as { code?: unknown })?.code
              ? ` (${String((error as { code?: unknown }).code)})`
              : ""
          }`;
    const at = new Date().toISOString();
    await sendEmail(config, {
      to: to.data,
      subject: "RevDistrict inventory import failed",
      text: [
        `The hourly inventory import failed at ${at}.`,
        `Stage: ${stage}`,
        `Detail: ${detail}`,
        "",
        "The site keeps showing the last good inventory until it is more than 72 hours old, then inventory pages show an error. Check the cron run logs in Vercel, the S3 file and the database.",
      ].join("\n"),
      idempotencyKey: `import-failure-${at.slice(0, 13)}-${stage}`,
    });
  } catch {
    console.error("Import failure alert could not be sent.");
  }
}
