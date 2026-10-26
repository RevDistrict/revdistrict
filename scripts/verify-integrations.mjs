import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createServer as createHttpServer } from "node:http";
import pg from "pg";
import { testDatabaseUrl } from "./test-database-url.mjs";
import { createServer as createTcpServer } from "node:net";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

// All submitted data and email destinations are isolated local fixtures.
let app, db, mail, browser;
let logs = "";
const received = [];
let rejectLead = false;
let omitMessageId = false;
try {
  const preview = JSON.parse(
    await readFile("src/data/legacy-vehicles.json", "utf8"),
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
  const databaseUrl = testDatabaseUrl();
  db = new pg.Client({ connectionString: databaseUrl });
  await db.connect();
  await db.query("DROP TABLE IF EXISTS vehicles, inventory_meta");
  await db.query(await readFile("db/schema.sql", "utf8"));
  await db.query(
    "INSERT INTO vehicles (id, status, data) VALUES ($1, $2, $3)",
    [vehicle.id, vehicle.status, vehicle],
  );
  await db.query(
    "INSERT INTO inventory_meta (singleton, captured_at) VALUES (true, now())",
  );
  mail = createHttpServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      const reply = (status, body) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(body));
      };
      if (
        request.method !== "POST" ||
        request.url !== "/emails" ||
        request.headers.authorization !== "Bearer fixture-key"
      )
        return reply(401, { message: "Invalid fixture credentials" });
      assert.ok(
        request.headers["idempotency-key"],
        "Each lead carries an idempotency key",
      );
      if (rejectLead) return reply(422, { message: "Synthetic refusal" });
      if (omitMessageId) return reply(200, {});
      const body = JSON.parse(raw);
      const [attachment] = body.attachments;
      assert.equal(attachment.filename, "lead.xml");
      received.push({
        raw,
        to: body.to,
        from: body.from,
        xml: Buffer.from(attachment.content, "base64").toString("utf8"),
      });
      reply(200, { id: "fixture-message-id" });
    });
  });
  await new Promise((resolve) => mail.listen(0, "127.0.0.1", resolve));
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
        RD_DATABASE_URL: databaseUrl,
        RESEND_API_URL: `http://127.0.0.1:${mail.address().port}/emails`,
        RESEND_API_KEY: "fixture-key",
        RESEND_FROM: "website@example.test",
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
    assert.deepEqual(email.to, ["leads@example.test"]);
    assert.ok(email.from.includes("<website@example.test>"));
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
  // The pulsing loading state animates opacity, so axe reads a transient low-contrast color from it.
  await page.locator(".loading-page").waitFor({ state: "detached" });
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
  origin = await startApp({ RESEND_API_KEY: "" });
  assert.equal(
    (await submit(lead)).status,
    503,
    "Missing email credentials must not claim delivery",
  );
  origin = await startApp({ RESEND_API_KEY: "incorrect" });
  assert.equal(
    (await submit(lead)).status,
    502,
    "A rejected API key must not claim delivery",
  );
  omitMessageId = true;
  origin = await startApp();
  const beforeUnconfirmed = received.length;
  assert.equal(
    (await submit(lead)).status,
    502,
    "A response without a message id must not claim delivery",
  );
  assert.equal(received.length, beforeUnconfirmed);
  assert.ok(
    !logs.includes(lead.email) &&
      !logs.includes(lead.message) &&
      !logs.includes("fixture-key"),
  );
  console.log(
    "PASS: inventory fixtures; all six inquiry types as authenticated Resend ADF email; recipient isolation, validation, rejected delivery, missing credentials, XML parsing and log redaction; provider iframe, retired native endpoint, responsive layout and accessibility.",
  );
} finally {
  if (browser) await browser.close();
  if (app && app.exitCode === null) {
    const exited = new Promise((resolve) => app.once("exit", resolve));
    app.kill("SIGTERM");
    await exited;
  }
  if (mail) await new Promise((resolve) => mail.close(resolve));
  await db?.end();
}
