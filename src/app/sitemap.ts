import type { MetadataRoute } from "next";
import { getVehicleSummaries } from "@/lib/inventory";
import { vehicleHref } from "@/lib/vehicle";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!process.env.SITE_URL) return [];
  const base = process.env.SITE_URL;
  const data = await getVehicleSummaries();
  return [
    ...[
      "",
      "/inventory",
      "/our-story",
      "/financing",
      "/financing/terms",
      "/consignment",
      "/sell-your-vehicle",
      "/contact-us",
      "/contact-us/text",
      "/privacy-policy",
    ].map((path) => ({ url: base + path })),
    ...data.vehicles.map((v) => ({
      url: base + vehicleHref(v),
      lastModified: data.updatedAt,
    })),
  ];
}
