import { parse } from "csv-parse/sync";
import {
  inventorySchema,
  vehicleHref,
  vehicleSchema,
  type Vehicle,
} from "./vehicle";

export const MAX_INVENTORY_BYTES = 10_000_000;
export const MAX_INVENTORY_AGE_MS = 72 * 60 * 60 * 1000;

type ImportOptions = {
  capturedAt: string;
  siteUrl: string;
  dealerId: string;
  legacyVehicles?: Pick<Vehicle, "id" | "vin" | "slug">[];
};

export function assertInventoryFresh(capturedAt: string, now = Date.now()) {
  const age = now - Date.parse(capturedAt);
  if (
    !Number.isFinite(age) ||
    age < -5 * 60 * 1000 ||
    age > MAX_INVENTORY_AGE_MS
  )
    throw new Error("Inventory export timestamp is invalid or out of date.");
}

function numeric(value: string, field: string, row: number, required = false) {
  if (!value && !required) return 0;
  if (!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(value))
    throw new Error(`CSV row ${row}: invalid ${field}.`);
  return Number(value.replace(/[$,]/g, ""));
}

function bodyType(value: string): Vehicle["body"] {
  const body = value.toLowerCase().replace(/[^a-z]/g, "");
  if (
    ["car", "sedan", "coupe", "convertible", "hatchback", "wagon"].includes(
      body,
    )
  )
    return "Car";
  if (
    ["suv", "sportutility", "sportutilityvehicle", "crossover"].includes(body)
  )
    return "SUV";
  if (["truck", "pickup", "pickuptruck"].includes(body)) return "Truck";
  if (["van", "minivan", "cargovan", "passengervan"].includes(body))
    return "Van";
  return "Other";
}

function description(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?\s*>|<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseDealrInventory(csv: string, options: ImportOptions) {
  if (Buffer.byteLength(csv) > MAX_INVENTORY_BYTES)
    throw new Error("Inventory CSV exceeds the supported size.");
  const origin = new URL(options.siteUrl);
  if (origin.protocol !== "https:" || origin.username || origin.password)
    throw new Error("Inventory site URL must be HTTPS without credentials.");
  if (!options.dealerId.trim())
    throw new Error("Expected DealerID is required.");
  assertInventoryFresh(options.capturedAt);

  let records: Record<string, string>[];
  try {
    records = parse(csv, {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      max_record_size: 250_000,
      columns: (headers: string[]) => {
        const required = [
          "DealerID",
          "VehicleID",
          "VIN",
          "Stock",
          "Year",
          "Make",
          "Model",
          "Trim",
          "ListPrice",
          "Mileage",
          "PhotoURL",
        ];
        if (
          new Set(headers).size !== headers.length ||
          required.some((key) => !headers.includes(key))
        )
          throw new Error("Invalid headers");
        return headers;
      },
    });
  } catch {
    // Parser errors can contain an entire raw row, including internal dealer costs.
    throw new Error(
      "Inventory CSV has invalid headers, quoting, or column counts.",
    );
  }
  records = records.filter((record) =>
    Object.values(record).some((value) => value.trim()),
  );
  if (!records.length || records.length > 1000)
    throw new Error(
      "Inventory CSV must contain 1–1000 populated vehicles; the schema-only sample cannot be published.",
    );

  const seenIds = new Set<string>();
  const seenVins = new Set<string>();
  const vehicles = records.map((record, index) => {
    const row = index + 2;
    const get = (key: string) => (record[key] || "").trim();
    if (get("DealerID") !== options.dealerId)
      throw new Error(
        `CSV row ${row}: DealerID does not match the configured dealership.`,
      );
    const id = get("VehicleID");
    const vin = get("VIN").toUpperCase();
    if (!id || seenIds.has(id) || (vin && seenVins.has(vin)))
      throw new Error(
        `CSV row ${row}: missing VehicleID or duplicate vehicle.`,
      );
    seenIds.add(id);
    if (vin) seenVins.add(vin);
    const year = numeric(get("Year"), "Year", row, true);
    const make = get("Make"),
      model = get("Model"),
      trim = get("Trim");
    if (!make || !model)
      throw new Error(`CSV row ${row}: Make and Model are required.`);
    const name = [year, make, model, trim].filter(Boolean).join(" ");
    const legacy = options.legacyVehicles?.find(
      (vehicle) =>
        vehicle.id === id && (!vin || vehicle.vin.toUpperCase() === vin),
    );
    const slug =
      legacy?.slug ||
      name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 200);
    const images = get("PhotoURL")
      .split(/[|\r\n]+/)
      .map((url) => url.trim())
      .filter(Boolean);
    for (const image of images) {
      let url: URL;
      try {
        url = new URL(image);
      } catch {
        throw new Error(`CSV row ${row}: invalid photo URL.`);
      }
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error(
          `CSV row ${row}: photos require separate HTTPS URLs (pipe or newline delimiter).`,
        );
    }
    const equipment = get("OptionDescription")
      // The live export joins "Label: value" options with commas; split only where a new label starts.
      .split(/[|\r\n]+|,\s*(?=[A-Z][^,:]{0,80}: )/)
      .map((item) => item.trim())
      .filter(Boolean);
    // The empty vendor sample does not establish promotional-price precedence.
    // Use only the advertised ListPrice, never CostPrice or WholesalePrice.
    const result = vehicleSchema.safeParse({
      id,
      slug,
      year,
      make,
      model,
      trim,
      name,
      price: numeric(get("ListPrice"), "ListPrice", row),
      mileage: numeric(get("Mileage"), "Mileage", row),
      stock: get("Stock"),
      vin,
      body: bodyType(get("BodyType") || get("BodyStyle")),
      drivetrain: get("Drivetrain"),
      transmission: get("Transmission") || get("TransmissionType"),
      engine:
        get("Engine Description") ||
        [
          get("EngineDisplacement") && `${get("EngineDisplacement")}L`,
          get("Cylinders") && `${get("Cylinders")}-cylinder`,
          get("FuelType"),
        ]
          .filter(Boolean)
          .join(" "),
      exterior: get("Exteriorcolor"),
      interior: get("Interiorcolor"),
      mpgCity: get("CityMPG"),
      mpgHighway: get("HwyMPG"),
      images: [...new Set(images)],
      description: description(get("DealerComments")),
      equipment: equipment.length ? { Features: [...new Set(equipment)] } : {},
      carfaxUrl: null,
      sourceUrl: new URL(vehicleHref({ id, slug }), origin.origin).href,
      status: "active",
    });
    if (!result.success)
      throw new Error(
        `CSV row ${row}: invalid vehicle fields (${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}).`,
      );
    return result.data;
  });
  return inventorySchema.parse({
    capturedAt: options.capturedAt,
    source: "dealr.cloud CSV export",
    vehicles,
  });
}
