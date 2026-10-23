import { Motion } from "@/components/motion";
import type { Metadata } from "next";
import { AmbientFilm } from "@/components/ambient-film";
import { Suspense } from "react";
import { toVehicleSummary } from "@/lib/vehicle";
import { getInventory } from "@/lib/inventory";
import { InventoryBrowser } from "@/components/inventory-browser";
export const metadata: Metadata = {
  title: "Find your next drive",
  description:
    "Explore used cars, trucks, SUVs and performance cars at RevDistrict in Midvale, Utah.",
};
export default async function InventoryPage() {
  const data = await getInventory();
  return (
    <>
      <section
        className="page-intro inventory-intro cinematic-intro"
        data-motion-section
      >
        <AmbientFilm
          src="/video/district-cabin-loop.mp4"
          poster="/images/district-bmw.webp"
          label="Inventory"
        />
        <div>
          <p className="eyebrow">THE REVDISTRICT COLLECTION</p>
          <h1>
            Find your
            <br />
            <span className="gold">kind of drive.</span>
          </h1>
        </div>
        <p>
          First car. Weekend escape. Everyday upgrade.
          <br />
          There’s a next chapter for everyone.
        </p>
      </section>
      <section className="section inventory-section">
        <Suspense fallback={<p>Loading your collection...</p>}>
          <InventoryBrowser vehicles={data.vehicles.map(toVehicleSummary)} />
        </Suspense>
      </section>
      <Motion />
    </>
  );
}
