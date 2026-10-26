// Fails a production Vercel build when the inventory import cannot work, instead of failing hourly at runtime.
if (process.env.VERCEL_ENV !== "production") process.exit(0);

const required = [
  "RD_DATABASE_URL",
  "CRON_SECRET",
  "SITE_URL",
  "DEALR_DEALER_ID",
  "S3_BUCKET_NAME",
  "S3_INVENTORY_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_REGION",
];
const problems = required
  .filter((name) => !process.env[name]?.trim())
  .map((name) => `${name} is not set`);
if (process.env.DEALR_FEED_MODE !== "full")
  problems.push("DEALR_FEED_MODE must be set to full");
if (process.env.SITE_URL && !process.env.SITE_URL.startsWith("https://"))
  problems.push("SITE_URL must be an https:// origin");

if (problems.length) {
  console.error(
    `Missing production environment variables:\n- ${problems.join("\n- ")}`,
  );
  process.exit(1);
}
