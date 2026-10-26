import { readFile } from "node:fs/promises";
import pg from "pg";

async function main() {
  // Neon recommends a direct (unpooled) connection for schema changes.
  const url =
    process.env.RD_DATABASE_URL_UNPOOLED || process.env.RD_DATABASE_URL;
  if (!url) throw new Error("Missing RD_DATABASE_URL.");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(await readFile("db/schema.sql", "utf8"));
    console.log("Database schema is up to date.");
  } finally {
    await client.end();
  }
}

main().catch(() => {
  console.error("Migration failed. Check RD_DATABASE_URL and database access.");
  process.exit(1);
});
