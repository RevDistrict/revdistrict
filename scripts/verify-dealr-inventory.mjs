import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";

const databaseUrl = process.env.TEST_DATABASE_URL;
assert.ok(
  databaseUrl,
  "Set TEST_DATABASE_URL to a throwaway Postgres database.",
);
const run = promisify(execFile);
const fixture = await readFile("tests/fixtures/dealr-inventory.csv");
let contents = fixture;
let modified = new Date();
const s3 = createHttpServer((request, response) => {
  if (request.url?.split("?")[0] !== "/fixture-bucket/inventory.csv") {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Content-Length": contents.length,
    "Last-Modified": modified.toUTCString(),
    ETag: `"${createHash("md5").update(contents).digest("hex")}"`,
  });
  response.end(request.method === "HEAD" ? undefined : contents);
});
let app;
const db = new pg.Client({ connectionString: databaseUrl });
try {
  await new Promise((resolve) => s3.listen(0, "127.0.0.1", resolve));
  await db.connect();
  await db.query("DROP TABLE IF EXISTS vehicles, inventory_meta");
  await run(process.execPath, ["--import", "tsx", "scripts/migrate.ts"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  const vehicleIds = async () =>
    (await db.query("SELECT id FROM vehicles ORDER BY id")).rows.map(
      (r) => r.id,
    );
  const env = {
    ...process.env,
    SITE_URL: "https://dealer.example",
    SITE_INDEXABLE: "false",
    DATABASE_URL: databaseUrl,
    DEALR_FEED_MODE: "full",
    DEALR_DEALER_ID: "demo-dealer",
    S3_BUCKET_NAME: "fixture-bucket",
    S3_INVENTORY_KEY: "inventory.csv",
    AWS_ENDPOINT_URL_S3: `http://127.0.0.1:${s3.address().port}`,
    AWS_REGION: "us-east-2",
    AWS_ACCESS_KEY_ID: "fixture",
    AWS_SECRET_ACCESS_KEY: "fixture",
  };
  const importCsv = (override = {}) =>
    run(process.execPath, ["--import", "tsx", "scripts/import-inventory.ts"], {
      env: { ...env, ...override },
      timeout: 55_000,
    });
  await importCsv();
  assert.deepEqual(await vehicleIds(), ["DEMO001", "DEMO002"]);
  await assert.rejects(importCsv({ S3_INVENTORY_KEY: "missing.csv" }));
  assert.deepEqual(await vehicleIds(), ["DEMO001", "DEMO002"]);
  modified = new Date(Date.now() - 96 * 60 * 60 * 1000);
  await assert.rejects(importCsv());
  assert.deepEqual(
    await vehicleIds(),
    ["DEMO001", "DEMO002"],
    "Stale S3 files cannot refresh inventory",
  );
  modified = new Date();

  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  app = spawn(process.execPath, ["server.cjs"], {
    env: { ...env, PORT: String(port) },
    stdio: "ignore",
  });
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`${origin}/api/leads`);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(ready, "Compiled app boots");
  const listing = await (await fetch(`${origin}/inventory`)).text();
  assert.ok(listing.includes("DEMO001") && listing.includes("DEMO002"));
  assert.ok(!listing.includes("Inventory preview"));
  const detailPath = "/inventory/2024-acura-integra-demo-a-spec/DEMO001";
  const detail = await (await fetch(origin + detailPath)).text();
  assert.ok(detail.includes("31,990") && detail.includes("23,071"));
  const redirect = await fetch(`${origin}/inventory/old-slug/DEMO001`, {
    redirect: "manual",
    headers: { "User-Agent": "Twitterbot" },
  });
  if (redirect.status === 308) {
    assert.equal(redirect.headers.get("location"), detailPath);
  } else {
    assert.equal(redirect.status, 200);
    const redirectHtml = await redirect.text();
    assert.ok(
      redirectHtml.includes('http-equiv="refresh"') &&
        redirectHtml.includes(`url=${detailPath}`),
      "Streaming response emits the canonical redirect",
    );
  }
  contents = Buffer.from(fixture.toString().replace("31,990", "30,990"));
  await importCsv();
  assert.ok(
    (await (await fetch(origin + detailPath)).text()).includes("30,990"),
    "Price updates without rebuilding",
  );
  // A later export that omits DEMO001 removes it from the site entirely.
  const lines = fixture.toString().split("\n");
  contents = Buffer.from([lines[0], lines[3]].join("\n"));
  await importCsv();
  assert.deepEqual(await vehicleIds(), ["DEMO002"]);
  const removed = await fetch(origin + detailPath);
  const removedHtml = await removed.text();
  assert.ok([200, 404].includes(removed.status));
  assert.ok(
    removedHtml.includes("off the map.") &&
      removedHtml.includes('content="noindex"'),
    "Removed stock renders the noindex not-found state, including streamed responses",
  );
  await run(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/import-inventory.ts",
      "--input",
      "tests/fixtures/dealr-inventory.csv",
      "--preview",
    ],
    { env },
  );
  assert.ok(
    (await (await fetch(`${origin}/inventory`)).text()).includes(
      "Inventory preview",
    ),
  );
  assert.ok(
    !(await (await fetch(`${origin}/sitemap.xml`)).text()).includes("DEMO001"),
  );
  console.log(
    "Verified local S3 import into Postgres, missing-object and stale-file retention, CSV vehicle pages, slug redirect, price refresh, removal and preview labeling.",
  );
} finally {
  app?.kill();
  await db.end();
  await new Promise((resolve) => s3.close(resolve));
}
