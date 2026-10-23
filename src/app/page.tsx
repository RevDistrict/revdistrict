import { Motion } from "@/components/motion";
import { ArrowUpRight } from "lucide-react";
import { Hero } from "@/components/hero";
import { DriveSelector } from "@/components/drive-selector";
import { Film } from "@/components/film";
import { Visit } from "@/components/visit";
import { ButtonLink } from "@/components/ui";
import { toVehicleSummary } from "@/lib/vehicle";
import { getInventory } from "@/lib/inventory";
export default async function Home() {
  const inventory = await getInventory();
  return (
    <>
      <Hero />
      <div className="brand-strip">
        <span className="mono">UTAH ROOTS. A NEW DIRECTION.</span>
        <p>
          More than a car.<span className="gold"> A connection.</span>
        </p>
        <span className="mono">
          WELCOME TO THE DISTRICT <ArrowUpRight size={18} />
        </span>
      </div>
      <DriveSelector vehicles={inventory.vehicles.map(toVehicleSummary)} />
      <section className="story-section section" id="the-district">
        <div className="story-copy">
          <p className="eyebrow">THE PEOPLE BEHIND THE KEYS</p>
          <h2 data-reveal>
            Car people.
            <br />
            <span data-sheen>Your people.</span>
          </h2>
          <p>
            We get it. The late-night searches. The saved listings. That one car
            you keep coming back to.
          </p>
          <p>
            We’re here for all of it. RevDistrict is a place for your first car,
            your next adventure, and the one you’ve always wanted. Real
            conversations with people who love this as much as you do.
          </p>
          <ButtonLink href="/our-story" variant="text">
            Meet RevDistrict
          </ButtonLink>
          <span className="story-coordinate mono">
            40.6233° N &nbsp; 111.8974° W
          </span>
        </div>
        <div className="story-film-wrap" data-image-reveal>
          <Film />
          <div className="story-inset">
            <img
              src="/images/district-culture.webp"
              width="800"
              height="400"
              alt="The team gathering around a car in the showroom"
              loading="lazy"
            />
            <span className="mono">A LITTLE LOOK BEHIND THE SCENES.</span>
          </div>
          <span className="film-edge-label mono">CARS BRING US TOGETHER.</span>
        </div>
      </section>
      <Visit />
      <Motion />
    </>
  );
}
