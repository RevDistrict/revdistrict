import test from "node:test";
import assert from "node:assert/strict";
import inventory from "../src/data/legacy-vehicles.json";
import {
  inventorySchema,
  vehicleHref,
  monthlyPayment,
  matchesMode,
} from "../src/lib/vehicle";
import {
  canResizeVehicleImage,
  vehicleImageLoader,
} from "../src/lib/vehicle-images";
import { leadSchema, rateLimit } from "../src/lib/leads";
const data = inventorySchema.parse(inventory);
test("source inventory retains real mileage, stock, equipment and body classifications", () => {
  const acura = data.vehicles.find((v) => v.id === "1173076")!;
  assert.equal(acura.mileage, 23071);
  assert.equal(acura.stock, "UCF008082");
  assert.equal(acura.drivetrain, "FWD");
  assert.equal(acura.price, 31990);
  assert.ok(acura.equipment.Comfort.length > 0);
  assert.equal(acura.images.length, 24);
  for (const model of ["Cayenne", "Equinox", "Trailblazer"])
    assert.ok(
      data.vehicles
        .filter((v) => v.model.toLowerCase() === model.toLowerCase())
        .every((v) => v.body === "SUV"),
    );
  for (const model of ["Gladiator", "Ridgeline"])
    assert.ok(
      data.vehicles
        .filter((v) => v.model === model)
        .every((v) => v.body === "Truck"),
    );
  assert.equal(
    new Set(data.vehicles.map((v) => v.id)).size,
    data.vehicles.length,
  );
});
test("old path punctuation and nested trim segments remain addressable", () => {
  for (const v of data.vehicles)
    assert.equal(
      decodeURIComponent(vehicleHref(v)),
      `/inventory/${v.slug}/${v.id}`,
    );
  assert.ok(data.vehicles.some((v) => v.slug.includes("/")));
});
test("budget calculations handle zero interest, full down payment, and standard amortization", () => {
  assert.equal(monthlyPayment(12000, 0, 0, 60), 200);
  assert.equal(monthlyPayment(12000, 14000, 8, 60), 0);
  assert.ok(Math.abs(monthlyPayment(30000, 4500, 8.9, 60) - 528.099) < 0.01);
});
test("drive selectors apply declared rules", () => {
  const acura = data.vehicles.find((v) => v.id === "1173076")!;
  assert.equal(matchesMode(acura, "all"), true);
  assert.equal(matchesMode(acura, "everyday"), false);
  assert.equal(matchesMode({ ...acura, body: "SUV" }, "adventure"), true);
});
const lead = {
  firstName: "Test",
  lastName: "Driver",
  email: "driver@example.com",
  phone: "8015550123",
  message: "Please tell me about this vehicle.",
  intent: "contact",
  consent: true,
};
test("lead validation rejects whitespace, incomplete phone, missing consent and incomplete test drives", () => {
  assert.ok(leadSchema.safeParse(lead).success);
  assert.equal(
    leadSchema.safeParse({ ...lead, firstName: "   " }).success,
    false,
  );
  assert.equal(
    leadSchema.safeParse({ ...lead, phone: "----------" }).success,
    false,
  );
  assert.equal(
    leadSchema.safeParse({ ...lead, consent: false }).success,
    false,
  );
  assert.equal(
    leadSchema.safeParse({ ...lead, intent: "test-drive" }).success,
    false,
  );
  assert.equal(
    leadSchema.safeParse({ ...lead, intent: "trade" }).success,
    false,
  );
});
test("rate limit bounds repeated submissions and recovers after expiry", () => {
  const id = "unit-" + Date.now();
  for (let n = 0; n < 5; n++) assert.equal(rateLimit(id, 100), true);
  assert.equal(rateLimit(id, 100), false);
  assert.equal(rateLimit(id, 60101), true);
});

test("provider image sizing preserves source URLs and supports a different DMS host", () => {
  const source = "https://cdn.dealrimages.com/car.jpg?w=1600&v=123";
  const thumbnail = vehicleImageLoader({ src: source, width: 240 });
  assert.equal(new URL(thumbnail).searchParams.get("w"), "240");
  assert.equal(new URL(thumbnail).searchParams.get("v"), "123");
  assert.equal(new URL(source).searchParams.get("w"), "1600");
  const other = "https://photos.example.com/car.jpg?signature=abc";
  assert.equal(canResizeVehicleImage(other), false);
  assert.equal(vehicleImageLoader({ src: other, width: 240 }), other);
});
