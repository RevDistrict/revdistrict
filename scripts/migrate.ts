import { readFile } from "node:fs/promises";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL.");
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
  console.error("Migration failed. Check DATABASE_URL and database access.");
  process.exit(1);
});
