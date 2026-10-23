import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import {
  parseDealrInventory,
  assertInventoryFresh,
} from "../src/lib/dealr-inventory";
import { vehicleHref } from "../src/lib/vehicle";

const fixture = readFileSync("tests/fixtures/dealr-inventory.csv", "utf8");
const options = {
  capturedAt: new Date().toISOString(),
  siteUrl: "https://dealer.example",
  dealerId: "demo-dealer",
};

test("vendor columns produce stable vehicle URLs, ordered photos and public fields only", () => {
  const data = parseDealrInventory("\uFEFF" + fixture, options);
  const [car, truck] = data.vehicles;
  assert.equal(
    vehicleHref(car),
    "/inventory/2024-acura-integra-demo-a-spec/DEMO001",
  );
  assert.equal(car.price, 31990);
  assert.equal(car.mileage, 23071);
  assert.equal(car.body, "Car");
  assert.equal(truck.body, "Truck");
  assert.equal(truck.price, 0);
  assert.equal(truck.mileage, 0);
  assert.deepEqual(truck.images, []);
  assert.equal(car.images.length, 3);
  assert.deepEqual(car.description, [
    "Synthetic integration example, not an offered vehicle.",
    'Quoted "CSV" description.',
  ]);
  assert.deepEqual(car.equipment.Features, ["Heated seats", "Backup camera"]);
  assert.equal(car.status, "active");
  const encoded = JSON.stringify(data);
  for (const privateValue of [
    "CostPrice",
    "WholesalePrice",
    "24000",
    "25000",
    "Dealer Email",
  ])
    assert.ok(!encoded.includes(privateValue));
});

test("legacy IDs retain their existing nested paths; name edits still retain identity", () => {
  const data = parseDealrInventory(fixture, {
    ...options,
    legacyVehicles: [
      { id: "DEMO001", vin: "TEST0000000000001", slug: "legacy/trim-name" },
    ],
  });
  assert.equal(
    vehicleHref(data.vehicles[0]),
    "/inventory/legacy/trim-name/DEMO001",
  );
  const changed = parseDealrInventory(
    fixture.replace("Demo A-Spec", "Updated trim"),
    options,
  );
  assert.equal(changed.vehicles[0].id, "DEMO001");
});

test("HTTPS image proxy URLs can contain an embedded source URL", () => {
  const data = parseDealrInventory(
    fixture.replaceAll(
      "https://cdn.dealrimages.com/",
      "https://photos.example/image?url=https://cdn.example/",
    ),
    options,
  );
  assert.ok(
    data.vehicles[0].images[0].startsWith(
      "https://photos.example/image?url=https://",
    ),
  );
});

test("schema-only, malformed, wrong-dealer, duplicate and invalid-number exports fail closed", async () => {
  const empty = await readFile("tests/fixtures/dealr-schema.csv", "utf8");
  assert.throws(
    () => parseDealrInventory(empty, options),
    /populated vehicles/,
  );
  assert.throws(
    () => parseDealrInventory('VIN,Year\n"unfinished', options),
    /headers, quoting/,
  );
  assert.throws(
    () =>
      parseDealrInventory(fixture, { ...options, dealerId: "other-dealer" }),
    /DealerID/,
  );
  assert.throws(
    () =>
      parseDealrInventory(fixture.replaceAll("DEMO002", "DEMO001"), options),
    /duplicate/,
  );
  assert.throws(
    () => parseDealrInventory(fixture.replace("31,990", "31x990"), options),
    /ListPrice/,
  );
  assert.throws(
    () => parseDealrInventory(fixture.replace("23,071", "23x071"), options),
    /Mileage/,
  );
  assert.throws(
    () => parseDealrInventory(fixture.replace("VehicleID,", "VIN,"), options),
    /headers/,
  );
  assert.throws(
    () =>
      parseDealrInventory(fixture.replaceAll("https://", "http://"), options),
    /HTTPS URLs/,
  );
});

test("stale and future live exports are rejected; preview records stay explicitly marked", () => {
  assert.throws(
    () => assertInventoryFresh("2020-01-01T00:00:00Z"),
    /out of date/,
  );
  assert.throws(() => assertInventoryFresh("not a date"), /invalid/);
  assert.throws(
    () => assertInventoryFresh(new Date(Date.now() + 3600000).toISOString()),
    /invalid/,
  );
});

test("the CLI requires explicit full-feed confirmation", () => {
  const unconfirmed = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/import-inventory.ts",
      "--input",
      "tests/fixtures/dealr-inventory.csv",
    ],
    {
      env: {
        ...process.env,
        SITE_URL: options.siteUrl,
        DEALR_DEALER_ID: options.dealerId,
        DEALR_FEED_MODE: "",
      },
      encoding: "utf8",
    },
  );
  assert.equal(unconfirmed.status, 1);
  assert.match(unconfirmed.stderr, /Confirm complete active-inventory/);
});
