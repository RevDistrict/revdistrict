import assert from "node:assert/strict";
import { generateKeyPairSync, createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import ssh2 from "ssh2";

const run = promisify(execFile);
const dir = await mkdtemp(join(tmpdir(), "dealr-sftp-test-"));
const output = join(dir, "inventory.json");
const fixture = await readFile("tests/fixtures/dealr-inventory.csv");
let contents = fixture;
let modified = Math.floor(Date.now() / 1000);
const password = randomUUID();
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { format: "pem", type: "pkcs1" },
  publicKeyEncoding: { format: "pem", type: "spki" },
});
const parsedKey = ssh2.utils.parseKey(privateKey);
assert.ok(!(parsedKey instanceof Error));
const fingerprint = createHash("sha256")
  .update(parsedKey.getPublicSSH())
  .digest("hex");
const connections = new Set();
const server = new ssh2.Server({ hostKeys: [privateKey] }, (client) => {
  connections.add(client);
  client.on("error", () => {});
  client.on("close", () => connections.delete(client));
  client.on("authentication", (context) => {
    if (
      context.method === "password" &&
      context.username === "fixture" &&
      context.password === password
    )
      context.accept();
    else context.reject();
  });
  client.on("ready", () =>
    client.on("session", (acceptSession) => {
      acceptSession().on("sftp", (acceptSftp) => {
        const sftp = acceptSftp();
        const stats = (id) =>
          sftp.attrs(id, {
            mode: 0o100600,
            size: contents.length,
            uid: 1000,
            gid: 1000,
            atime: modified,
            mtime: modified,
          });
        sftp.on("STAT", (id, path) =>
          path === "/inventory.csv" ? stats(id) : sftp.status(id, 2),
        );
        sftp.on("FSTAT", stats);
        sftp.on("OPEN", (id, path, flags) =>
          path === "/inventory.csv" && flags === 1
            ? sftp.handle(id, Buffer.from([1]))
            : sftp.status(id, 3),
        );
        sftp.on("READ", (id, _handle, offset, length) => {
          if (offset >= contents.length) sftp.status(id, 1);
          else sftp.data(id, contents.subarray(offset, offset + length));
        });
        sftp.on("CLOSE", (id) => sftp.status(id, 0));
      });
    }),
  );
});
let app;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const env = {
    ...process.env,
    SITE_URL: "https://dealer.example",
    SITE_INDEXABLE: "false",
    INVENTORY_FILE_PATH: output,
    INVENTORY_FEED_URL: "",
    DEALR_FEED_MODE: "full",
    DEALR_DEALER_ID: "demo-dealer",
    DEALR_SFTP_HOST: "127.0.0.1",
    DEALR_SFTP_PORT: String(server.address().port),
    DEALR_SFTP_USERNAME: "fixture",
    DEALR_SFTP_PASSWORD: password,
    DEALR_SFTP_PRIVATE_KEY_PATH: "",
    DEALR_SFTP_HOST_SHA256: fingerprint,
    DEALR_SFTP_PATH: "/inventory.csv",
  };
  const importCsv = (override = {}) =>
    run(process.execPath, ["--import", "tsx", "scripts/import-inventory.ts"], {
      env: { ...env, ...override },
      timeout: 55_000,
    });
  await importCsv();
  assert.equal(JSON.parse(await readFile(output, "utf8")).vehicles.length, 2);
  const valid = await readFile(output, "utf8");
  const preload = join(dir, "stalled-shutdown.mjs");
  const clientModule = pathToFileURL(
    createRequire(import.meta.url).resolve("ssh2-sftp-client"),
  ).href;
  await writeFile(
    preload,
    `import Client from ${JSON.stringify(clientModule)}; Client.prototype.end = () => new Promise(() => {});`,
  );
  await assert.rejects(
    run(
      process.execPath,
      ["--import", preload, "--import", "tsx", "scripts/import-inventory.ts"],
      { env, timeout: 12_000 },
    ),
    (error) => error.code === 1 && /could not close cleanly/.test(error.stderr),
  );
  assert.equal(
    await readFile(output, "utf8"),
    valid,
    "Stalled shutdown cannot publish a snapshot",
  );
  await assert.rejects(readFile(`${output}.lock`), { code: "ENOENT" });
  await assert.rejects(importCsv({ DEALR_SFTP_HOST_SHA256: "0".repeat(64) }));
  assert.equal(
    await readFile(output, "utf8"),
    valid,
    "Unknown host cannot replace inventory",
  );
  modified -= 48 * 60 * 60;
  await assert.rejects(importCsv());
  assert.equal(
    await readFile(output, "utf8"),
    valid,
    "Stale SFTP files cannot refresh inventory",
  );
  modified = Math.floor(Date.now() / 1000);

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
  const snapshot = JSON.parse(await readFile(output, "utf8"));
  snapshot.vehicles = snapshot.vehicles.filter((v) => v.id === "DEMO002");
  await writeFile(output, JSON.stringify(snapshot));
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
    "Verified local SFTP import, host-key rejection, stale-file retention, CSV vehicle pages, slug redirect, price refresh, removal and preview labeling.",
  );
} finally {
  app?.kill();
  for (const client of connections) client.end();
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
}
