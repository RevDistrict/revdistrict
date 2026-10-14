import { z } from "zod";
const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "HTTPS required");
export const vehicleSchema = z.object({
  id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .max(80),
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9/.'"+&-]*$/)
    .max(200),
  year: z.number().int().min(1900).max(2100),
  make: z.string().max(80),
  model: z.string().max(100),
  trim: z.string().max(180),
  name: z.string().max(250),
  price: z.number().min(0).max(10000000),
  mileage: z.number().min(0).max(2000000),
  stock: z.string().max(100),
  vin: z.string().max(17),
  body: z.enum(["Car", "SUV", "Truck", "Van", "Other"]),
  drivetrain: z.string().max(80),
  transmission: z.string().max(120),
  engine: z.string().max(180),
  exterior: z.string().max(100),
  interior: z.string().max(100),
  mpgCity: z.string().max(20),
  mpgHighway: z.string().max(20),
  images: z.array(httpsUrl).max(150),
  description: z.array(z.string().max(15000)).max(40),
  equipment: z.record(z.string(), z.array(z.string().max(1000)).max(500)),
  carfaxUrl: httpsUrl.nullable(),
  sourceUrl: httpsUrl,
  status: z.enum(["active", "sold", "inactive", "preview"]),
});
export const inventorySchema = z.object({
  capturedAt: z.iso.datetime(),
  source: z.string().max(500),
  isPreview: z.boolean().default(false),
  vehicles: z.array(vehicleSchema).max(1000),
});
export type Vehicle = z.infer<typeof vehicleSchema>;
export const vehicleHref = (v: Pick<Vehicle, "slug" | "id">) =>
  `/inventory/${v.slug.split("/").map(encodeURIComponent).join("/")}/${v.id}`;
export type DriveMode = "all" | "performance" | "adventure" | "everyday";
export const driveModes = [
  { id: "all", label: "All drives" },
  { id: "performance", label: "Performance" },
  { id: "adventure", label: "Adventure" },
  { id: "everyday", label: "Everyday" },
] as const;
export function matchesMode(v: Vehicle, mode: string) {
  if (mode === "performance")
    return /\b(M[2345]|RS\s?\d|AMG|ST|GT|GSR|SRT|WRX|Challenger|Charger|Corvette|Mustang|911|Cayman|Supra)\b/i.test(
      v.name,
    );
  if (mode === "adventure") return v.body === "SUV" || v.body === "Truck";
  if (mode === "everyday") return v.price > 0 && v.price < 20000;
  return true;
}
export function monthlyPayment(
  price: number,
  down: number,
  apr: number,
  months: number,
) {
  const principal = Math.max(0, price - down),
    rate = apr / 1200;
  if (months <= 0 || !Number.isFinite(months)) return 0;
  return rate === 0
    ? principal / months
    : (principal * rate * Math.pow(1 + rate, months)) /
        (Math.pow(1 + rate, months) - 1);
}

export function toVehicleSummary(vehicle: Vehicle) {
  return {
    ...vehicle,
    images: vehicle.images.slice(0, 1),
    photoCount: vehicle.images.length,
    description: [],
    equipment: {},
  };
}
