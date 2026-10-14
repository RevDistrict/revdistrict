import test from "node:test";
import assert from "node:assert/strict";
import { createAdfLead, dealrLeadRecipient, leadLabels } from "../src/lib/adf";
import { leadSchema } from "../src/lib/leads";
import inventory from "../src/data/inventory-preview.json";
import { vehicleSchema } from "../src/lib/vehicle";

const base = {
  firstName: "Synthetic",
  lastName: "Driver",
  email: "test@example.com",
  phone: "8015550123",
  message: "Please tell me about this car.",
  intent: "contact",
  consent: true,
};
const context = {
  reference: "synthetic-reference",
  submittedAt: "2026-10-14T21:00:00.000Z",
  siteUrl: "https://dealer.example",
  recipient: dealrLeadRecipient,
};
const trade = {
  year: 2020,
  make: "Example",
  model: "Car",
  mileage: 0,
  condition: "Good",
  payoff: "1200",
};

test("all inquiry intents preserve their purpose and consent in ADF", () => {
  for (const intent of Object.keys(leadLabels)) {
    const lead = leadSchema.parse({
      ...base,
      intent,
      trade,
      preferredDate: "2026-10-20",
      preferredTime: "Afternoon",
      textConsent: true,
    });
    const xml = createAdfLead(lead, context);
    assert.ok(xml.includes(`Request: ${leadLabels[lead.intent]}`));
    assert.ok(xml.includes("Text-message consent: yes."));
    assert.ok(xml.includes("Permission to contact about this request: yes."));
    assert.ok(
      xml.includes(
        "<email>dealer-the-used-car-factory@leads.dealrcloud.com</email>",
      ),
    );
    if (intent === "test-drive") {
      assert.ok(xml.includes('interest="test-drive"'));
      assert.ok(
        xml.includes(
          "Requested appointment (not confirmed): 2026-10-20, Afternoon",
        ),
      );
    }
  }
});

test("XML metacharacters and invalid controls cannot inject ADF elements", () => {
  const xml = createAdfLead(
    leadSchema.parse({
      ...base,
      firstName: 'A & B < C " D',
      message: "</comments><vendor>attacker</vendor>\u0000\u000b\ud800😊",
    }),
    context,
  );
  assert.ok(xml.includes("A &amp; B &lt; C &quot; D"));
  assert.ok(
    xml.includes("&lt;/comments&gt;&lt;vendor&gt;attacker&lt;/vendor&gt;😊"),
  );
  assert.equal((xml.match(/<vendor>/g) || []).length, 1);
  assert.ok(!xml.includes("\u0000") && !xml.includes("\ud800"));
});

test("inquiries use server inventory identity, not a client-supplied vehicle name", () => {
  const vehicle = vehicleSchema.parse(inventory.vehicles[0]);
  const xml = createAdfLead(
    leadSchema.parse({
      ...base,
      intent: "availability",
      vehicleId: vehicle.id,
      vehicleName: "Forged model",
    }),
    { ...context, vehicle },
  );
  for (const [tag, value] of Object.entries({
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    stock: vehicle.stock,
    vin: vehicle.vin,
  }))
    assert.ok(xml.includes(`<${tag}>${value}</${tag}>`));
  assert.ok(xml.includes(`<id source="dealr.cloud">${vehicle.id}</id>`));
  assert.ok(!xml.includes("Forged model"));
});

test("general and missing-vehicle inquiries leave unknown facts empty", () => {
  const xml = createAdfLead(
    leadSchema.parse({
      ...base,
      vehicleId: "removed-car",
      vehicleName: "Unverified car",
    }),
    context,
  );
  assert.ok(
    xml.includes("<year></year>") &&
      xml.includes("<make></make>") &&
      xml.includes("<model></model>"),
  );
  assert.ok(!xml.includes("<vin>") && !xml.includes("<stock>"));
  assert.ok(xml.includes("Requested website vehicle ID: removed-car"));
  assert.ok(xml.includes("Text-message consent: no."));
});

test("valuation and consignment preserve customer vehicle facts and payoff", () => {
  for (const intent of ["trade", "consignment"]) {
    const xml = createAdfLead(
      leadSchema.parse({ ...base, intent, trade }),
      context,
    );
    assert.ok(
      xml.includes(`interest="${intent === "trade" ? "trade-in" : "sell"}"`),
    );
    assert.ok(xml.includes('<odometer units="mi">0</odometer>'));
    assert.ok(xml.includes("Customer-reported condition: Good"));
    assert.ok(xml.includes("Customer-reported payoff: 1200"));
  }
});

test("text-back needs explicit text consent and forwards a phone without inventing an email", () => {
  assert.equal(
    leadSchema.safeParse({ ...base, intent: "text", email: "" }).success,
    false,
  );
  const lead = leadSchema.parse({
    ...base,
    intent: "text",
    email: "",
    textConsent: true,
  });
  const customer = createAdfLead(lead, context)
    .split("<customer>")[1]
    .split("</customer>")[0];
  assert.ok(!customer.includes("<email>"));
  assert.ok(customer.includes('<phone type="cellphone">8015550123</phone>'));
});
