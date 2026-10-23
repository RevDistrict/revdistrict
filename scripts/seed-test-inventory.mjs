// Loads the 262-vehicle legacy fixture into the throwaway test database for the Playwright suite.
import { readFile } from "node:fs/promises";
import pg from "pg";
import { testDatabaseUrl } from "./test-database-url.mjs";

const { vehicles } = JSON.parse(
  await readFile("src/data/legacy-vehicles.json", "utf8"),
);
const db = new pg.Client({ connectionString: testDatabaseUrl() });
await db.connect();
try {
  await db.query("DROP TABLE IF EXISTS vehicles, inventory_meta");
  await db.query(await readFile("db/schema.sql", "utf8"));
  for (const v of vehicles)
    await db.query(
      "INSERT INTO vehicles (id, status, data) VALUES ($1, $2, $3)",
      [v.id, v.status, v],
    );
  await db.query(
    "INSERT INTO inventory_meta (singleton, captured_at) VALUES (true, now())",
  );
  console.log(`Seeded ${vehicles.length} vehicles.`);
} finally {
  await db.end();
}
