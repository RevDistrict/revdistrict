import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SMTPServer } from "smtp-server";
import pg from "pg";
import { createServer as createTcpServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";

// All submitted data and SMTP/HTTPS destinations are isolated local fixtures.
const dir = await mkdtemp(join(tmpdir(), "revdistrict-integration-"));
let app, db, smtp, browser;
let logs = "";
const received = [];
let rejectLead = false;
try {
  const key = join(dir, "key.pem"),
    cert = join(dir, "cert.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
      "-keyout",
      key,
      "-out",
      cert,
    ],
    { stdio: "ignore" },
  );
  const tls = { key: await readFile(key), cert: await readFile(cert) };
  const preview = JSON.parse(
    await readFile("src/data/inventory-preview.json", "utf8"),
  );
  const vehicle = {
    ...preview.vehicles[0],
    id: "fixture-active",
    slug: "fixture-car",
    name: "Fixture vehicle",
    model: "Fixture",
    images: [],
    price: 0,
    mileage: 0,
    status: "active",
  };
  assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL.");
  db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  await db.query("DROP TABLE IF EXISTS vehicles, inventory_meta");
  await db.query(await readFile("db/schema.sql", "utf8"));
  await db.query(
    "INSERT INTO vehicles (id, status, data) VALUES ($1, $2, $3)",
    [vehicle.id, vehicle.status, vehicle],
  );
  await db.query(
    "INSERT INTO inventory_meta (singleton, captured_at, is_preview) VALUES (true, now(), false)",
  );
  smtp = new SMTPServer({
    ...tls,
    secure: false,
    logger: false,
    onAuth(auth, session, callback) {
      assert.ok(session.secure, "SMTP authentication requires TLS");
      if (
        auth.username !== "fixture-user" ||
        auth.password !== "fixture-password"
      )
        return callback(new Error("Invalid fixture credentials"));
      callback(null, { user: "fixture-user" });
    },
    onRcptTo(address, session, callback) {
      if (address.address !== "leads@example.test")
        return callback(new Error("Unexpected recipient"));
      callback();
    },
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (chunk) => {
        raw += chunk.toString();
      });
      stream.on("end", () => {
        if (rejectLead)
          return callback(
            Object.assign(new Error("Synthetic refusal"), {
              responseCode: 451,
            }),
          );
        assert.ok(session.secure);
        const encoded = raw.match(
          /Content-Type: application\/xml[^]*?Content-Transfer-Encoding: base64[^]*?\r\n\r\n([^]*?)\r\n--/i,
        )?.[1];
        assert.ok(
          encoded,
          "ADF uses the specification's application/xml MIME part",
        );
        received.push({
          raw,
          xml: Buffer.from(encoded.replace(/\s/g, ""), "base64").toString(
            "utf8",
          ),
          envelope: session.envelope,
        });
        callback(null, "Queued synthetic fixture");
      });
    },
  });
  await new Promise((resolve) => smtp.listen(0, "127.0.0.1", resolve));
  async function stopApp() {
    if (app && app.exitCode === null) {
      const exited = new Promise((resolve) => app.once("exit", resolve));
      app.kill("SIGTERM");
      await exited;
    }
  }
  async function startApp(overrides = {}) {
    await stopApp();
    const probe = createTcpServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    const origin = `http://localhost:${port}`;
    app = spawn(process.execPath, ["server.cjs"], {
      env: {
        ...process.env,
        PORT: String(port),
        SITE_URL: origin,
        SITE_INDEXABLE: "false",
        NODE_EXTRA_CA_CERTS: cert,
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        SMTP_HOST: "localhost",
        SMTP_PORT: String(smtp.server.address().port),
        SMTP_USER: "fixture-user",
        SMTP_PASSWORD: "fixture-password",
        SMTP_FROM: "website@example.test",
        ADF_LEAD_TO: "leads@example.test",
        ...overrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    app.stdout.on("data", (data) => {
      logs += data;
    });
    app.stderr.on("data", (data) => {
      logs += data;
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        await fetch(`${origin}/api/leads`);
        return origin;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new Error("Compiled app did not start");
  }
  let origin = await startApp();
  const inventory = await (await fetch(`${origin}/inventory`)).text();
  assert.ok(
    inventory.includes("Photos coming soon") &&
      inventory.includes("fixture-active"),
  );
  assert.ok(!inventory.includes("Inventory preview"));
  const detail = await (
    await fetch(`${origin}/inventory/fixture-car/fixture-active`)
  ).text();
  assert.ok(detail.includes("Photos are on the way."));
  const structured = [
    ...detail.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g),
  ]
    .map((match) => JSON.parse(match[1]))
    .find((data) => data["@type"] === "Car");
  assert.ok(
    structured && !structured.offers && !structured.mileageFromOdometer,
  );
  const lead = {
    firstName: "Synthetic",
    lastName: "Fixture",
    email: "test@example.com",
    phone: "8015550123",
    message: "Synthetic integration test only.",
    intent: "contact",
    consent: true,
  };
  let submission = 0;
  const submit = (data, headers = {}) =>
    fetch(`${origin}/api/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin,
        "X-Forwarded-For": `192.0.2.${++submission}`,
        ...headers,
      },
      body: JSON.stringify(data),
    });
  for (const intent of [
    "contact",
    "availability",
    "test-drive",
    "trade",
    "consignment",
    "text",
  ]) {
    const response = await submit({
      ...lead,
      intent,
      email: intent === "text" ? "" : lead.email,
      textConsent: intent === "text",
      vehicleId: ["availability", "test-drive"].includes(intent)
        ? vehicle.id
        : undefined,
      vehicleName: "Forged vehicle",
      preferredDate: "2026-10-20",
      preferredTime: "Afternoon",
      trade: ["trade", "consignment"].includes(intent)
        ? {
            year: 2020,
            make: "Fixture",
            model: "Trade",
            mileage: 12345,
            condition: "Good",
          }
        : undefined,
      to: "attacker@example.test",
    });
    assert.equal(response.status, 201, intent);
    const receipt = await response.json();
    const email = received.at(-1);
    assert.ok(email.xml.includes(receipt.reference));
    assert.equal(email.envelope.rcptTo.length, 1);
    assert.equal(email.envelope.rcptTo[0].address, "leads@example.test");
    assert.equal(email.envelope.mailFrom.address, "website@example.test");
    assert.ok(
      !email.raw.includes("attacker@example.test") &&
        !email.xml.includes("Forged vehicle"),
    );
    if (intent === "availability") {
      assert.ok(
        email.xml.includes(`<vin>${vehicle.vin}</vin>`) &&
          email.xml.includes(`<stock>${vehicle.stock}</stock>`),
      );
      assert.ok(
        !email.xml.includes("<odometer"),
        "Unknown inventory mileage stays unknown",
      );
    }
  }
  const delivered = received.length;
  assert.equal((await submit({ ...lead, consent: false })).status, 400);
  assert.equal((await submit({ ...lead, website: "bot" })).status, 400);
  assert.equal(
    (await submit(lead, { origin: "https://attacker.example" })).status,
    403,
  );
  assert.equal(
    (await submit({ ...lead, message: "x".repeat(17000) })).status,
    413,
  );
  rejectLead = true;
  assert.equal((await submit(lead)).status, 502);
  assert.equal(received.length, delivered);
  rejectLead = false;
  assert.equal(
    (await submit({ ...lead, vehicleId: "removed-vehicle" })).status,
    201,
  );
  assert.ok(received.at(-1).xml.includes("<year></year>"));

  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      (process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : undefined),
  });
  const browserContext = await browser.newContext();
  const page = await browserContext.newPage();
  await page.route("https://staging.dealr.website/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html lang='en'><title>Provider fixture</title><main><h1>Provider application fixture</h1></main></html>",
    }),
  );
  const application = await page.goto(
    `${origin}/financing/apply?entry_id=fixture-active`,
  );
  assert.equal(application.headers()["referrer-policy"], "no-referrer");
  assert.ok(application.headers()["cache-control"].includes("no-store"));
  assert.equal(
    await page
      .locator('iframe[title="Credit Application"]')
      .getAttribute("src"),
    "https://staging.dealr.website/39984",
  );
  assert.equal(await page.locator('input[name*="ssn"]').count(), 0);
  assert.ok(
    (await page.locator(".credit-application-note").innerText()).includes(
      "Fixture vehicle",
    ),
  );
  assert.equal(
    (
      await fetch(`${origin}/api/finance`, {
        method: "POST",
        body: "discarded synthetic body",
      })
    ).status,
    410,
  );
  const parsed = await page.evaluate(
    (docs) =>
      docs.map((xml) => {
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        return {
          errors: doc.querySelectorAll("parsererror").length,
          prospects: doc.querySelectorAll("adf > prospect").length,
          name: doc.querySelector('customer name[part="first"]')?.textContent,
        };
      }),
    received.map((message) => message.xml),
  );
  for (const doc of parsed)
    assert.deepEqual(doc, { errors: 0, prospects: 1, name: "Synthetic" });
  const accessibility = await new AxeBuilder({ page })
    .exclude("iframe")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    accessibility.violations.map((v) => v.id),
    [],
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.close();
  origin = await startApp({ SMTP_PASSWORD: "" });
  assert.equal(
    (await submit(lead)).status,
    503,
    "Missing SMTP credentials must not claim delivery",
  );
  origin = await startApp({ SMTP_PASSWORD: "incorrect" });
  assert.equal(
    (await submit(lead)).status,
    502,
    "Failed SMTP authentication must not claim delivery",
  );
  smtp.options.disabledCommands.push("AUTH");
  smtp.options.authOptional = true;
  origin = await startApp();
  const beforeAuthless = received.length;
  assert.equal(
    (await submit(lead)).status,
    502,
    "A TLS relay without AUTH must not receive a lead",
  );
  assert.equal(received.length, beforeAuthless);
  assert.ok(
    !logs.includes(lead.email) &&
      !logs.includes(lead.message) &&
      !logs.includes("fixture-password"),
  );
  console.log(
    "PASS: inventory fixtures; all six inquiry types as authenticated TLS ADF email; recipient isolation, validation, rejected delivery, missing credentials, XML parsing and log redaction; provider iframe, retired native endpoint, responsive layout and accessibility.",
  );
} finally {
  if (browser) await browser.close();
  if (app && app.exitCode === null) {
    const exited = new Promise((resolve) => app.once("exit", resolve));
    app.kill("SIGTERM");
    await exited;
  }
  if (smtp) await new Promise((resolve) => smtp.close(resolve));
  await db?.end();
  await rm(dir, { recursive: true, force: true });
}
