import type { Lead } from "./leads";
import type { Vehicle } from "./vehicle";
import { site } from "./site";

export const dealrLeadRecipient =
  "dealer-the-used-car-factory@leads.dealrcloud.com";
export const leadLabels: Record<Lead["intent"], string> = {
  contact: "Contact request",
  availability: "Vehicle inquiry",
  "test-drive": "Test-drive request",
  trade: "Sell / trade valuation",
  consignment: "Consignment consultation",
  text: "Text-back request",
};

function xml(value: string | number) {
  return String(value)
    .replace(
      /[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu,
      "",
    )
    .replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[char]!,
    );
}
const tag = (name: string, value: string | number) =>
  `<${name}>${xml(value)}</${name}>`;

export function createAdfLead(
  lead: Lead,
  context: {
    reference: string;
    submittedAt: string;
    siteUrl: string;
    recipient: string;
    vehicle?: Vehicle;
  },
) {
  const trade = ["trade", "consignment"].includes(lead.intent)
    ? lead.trade
    : undefined;
  const car = trade || context.vehicle;
  const interest = trade
    ? lead.intent === "consignment"
      ? "sell"
      : "trade-in"
    : lead.intent === "test-drive"
      ? "test-drive"
      : "buy";
  const comments = [
    `Request: ${leadLabels[lead.intent]}`,
    lead.message,
    lead.vehicleId ? `Requested website vehicle ID: ${lead.vehicleId}` : "",
    !car
      ? "No verified vehicle details supplied; year, make and model are unspecified."
      : "",
    lead.intent === "test-drive"
      ? `Requested appointment (not confirmed): ${lead.preferredDate}, ${lead.preferredTime}`
      : "",
    trade ? `Customer-reported condition: ${trade.condition}` : "",
    trade?.payoff ? `Customer-reported payoff: ${trade.payoff}` : "",
    "Permission to contact about this request: yes.",
    `Text-message consent: ${lead.textConsent ? "yes" : "no"}.`,
    `Submitted at: ${context.submittedAt}`,
  ]
    .filter(Boolean)
    .join("\n");

  // ADF 1.0 requires a vehicle block. Empty facts preserve general inquiries without inventing a car.
  return `<?xml version="1.0" encoding="UTF-8"?>
<?adf version="1.0"?>
<adf>
  <prospect status="new">
    <id source="RevDistrict website">${xml(context.reference)}</id>
    ${tag("requestdate", context.submittedAt)}
    <vehicle interest="${interest}" status="used">
      ${!trade && context.vehicle ? `<id source="dealr.cloud">${xml(context.vehicle.id)}</id>` : ""}
      ${tag("year", car?.year ?? "")}
      ${tag("make", car?.make ?? "")}
      ${tag("model", car?.model ?? "")}
      ${car?.vin ? tag("vin", car.vin) : ""}
      ${!trade && context.vehicle?.stock ? tag("stock", context.vehicle.stock) : ""}
      ${car?.trim ? tag("trim", car.trim) : ""}
      ${car && (trade || car.mileage > 0) ? `<odometer units="mi">${xml(car.mileage)}</odometer>` : ""}
    </vehicle>
    <customer>
      <contact>
        <name part="first">${xml(lead.firstName)}</name>
        <name part="last">${xml(lead.lastName)}</name>
        ${lead.email ? tag("email", lead.email) : ""}
        <phone type="${lead.intent === "text" ? "cellphone" : "voice"}">${xml(lead.phone)}</phone>
      </contact>
      ${tag("comments", comments)}
    </customer>
    <vendor>
      <vendorname>RevDistrict / The Used Car Factory</vendorname>
      ${tag("url", context.siteUrl)}
      <contact>
        <name part="full">Sales team</name>
        ${tag("email", context.recipient)}
        ${tag("phone", site.phone)}
        <address><street>${xml(site.address)}</street><city>Midvale</city><regioncode>UT</regioncode><postalcode>84047</postalcode><country>US</country></address>
      </contact>
    </vendor>
    <provider>
      <name part="full">RevDistrict website</name>
      ${tag("service", leadLabels[lead.intent])}
      ${tag("url", context.siteUrl)}
    </provider>
  </prospect>
</adf>`;
}
