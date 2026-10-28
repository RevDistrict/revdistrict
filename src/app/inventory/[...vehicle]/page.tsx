import { Motion } from "@/components/motion";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Phone,
  MessageSquare,
  Check,
} from "lucide-react";
import { getVehicle, getVehicleSummaries } from "@/lib/inventory";
import { vehicleHref } from "@/lib/vehicle";
import { money, number, site } from "@/lib/site";
import { VehicleGallery } from "@/components/vehicle-gallery";
import { VehicleActions } from "@/components/vehicle-actions";
import { PaymentCalculator } from "@/components/payment-calculator";
import { LeadForm } from "@/components/lead-form";
import { VehicleCard } from "@/components/vehicle-card";
import { ButtonLink } from "@/components/ui";
type Props = { params: Promise<{ vehicle: string[] }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vehicle } = await params;
  const v = await getVehicle(vehicle.at(-1) ?? "");
  if (!v) return { title: "Vehicle not found" };
  return {
    title: v.name,
    description: `Explore the ${v.name} at RevDistrict, Midvale, Utah. ${v.mileage ? `${number(v.mileage)} miles. ` : ""}View photos, specifications, and request a test drive.`,
    alternates: { canonical: vehicleHref(v) },
    openGraph: { images: v.images.slice(0, 1) },
  };
}
export default async function VehiclePage({ params }: Props) {
  const { vehicle } = await params;
  const v = await getVehicle(vehicle.at(-1) ?? "");
  if (!v) notFound();
  if (vehicle.join("/") !== v.slug + "/" + v.id)
    permanentRedirect(vehicleHref(v));
  const similar = (await getVehicleSummaries()).vehicles
    .filter((item) => item.id !== v.id && item.body === v.body)
    .sort((a, b) => Math.abs(a.price - v.price) - Math.abs(b.price - v.price))
    .slice(0, 3);
  const specs = [
    ["MILEAGE", v.mileage ? `${number(v.mileage)} mi` : "On request"],
    ["ENGINE", v.engine || "Ask the team"],
    ["TRANSMISSION", v.transmission || "Ask the team"],
    ["DRIVETRAIN", v.drivetrain || "Ask the team"],
    ["EXTERIOR", v.exterior || "Ask the team"],
    ["INTERIOR", v.interior || "Ask the team"],
    ["STOCK NUMBER", v.stock],
    ["VIN", v.vin || "Ask the team"],
  ];
  return (
    <>
      <div className="vehicle-breadcrumb">
        <Link href="/inventory">
          <ArrowLeft size={15} /> Back to inventory
        </Link>
        <span className="mono">
          {v.year} / {v.make} / {v.model}
        </span>
      </div>
      <VehicleGallery images={v.images} name={v.name} />
      <div className="vehicle-title-band">
        <div>
          <p className="eyebrow">
            {v.year} {v.make.toUpperCase()}
          </p>
          <h1>
            {v.model}
            <span>{v.trim}</span>
          </h1>
        </div>
        <div className="vehicle-price">
          <span className="mono">ASKING PRICE</span>
          <strong>{v.price ? money(v.price) : "Call for price"}</strong>
          <span>Plus taxes, registration and applicable fees</span>
        </div>
      </div>
      <div className="vehicle-jumpbar">
        <nav aria-label="Vehicle sections">
          <a href="#overview">Overview</a>
          <a href="#details">The details</a>
          <a href="#payment">Your budget</a>
          <a href="#inquire">Make it yours</a>
        </nav>
        <VehicleActions id={v.id} name={v.name} />
      </div>
      <div className="vehicle-body section" data-motion-section>
        <div className="vehicle-content">
          <section id="overview" className="vehicle-overview">
            <p className="eyebrow">MEET YOUR NEXT CHAPTER</p>
            <h2>
              {v.model}.<br />
              Worth a closer look.
            </h2>
            {v.description.length ? (
              v.description.slice(0, 5).map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p>
                Explore this {v.year} {v.make} {v.model} in person at our
                Midvale showroom. Ask our team about its condition, history,
                features, and availability.
              </p>
            )}
            {v.carfaxUrl && (
              <a
                className="history-link"
                href={v.carfaxUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Check size={18} />
                <span>
                  Know the story.
                  <strong>View the CARFAX vehicle history report</strong>
                </span>
                <ArrowUpRight size={20} />
              </a>
            )}
          </section>
          <section id="details" className="vehicle-specifications">
            <h2>All in the details.</h2>
            <dl className="spec-grid">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <dt className="mono">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="equipment-note">
              Equipment lists reflect original specifications. Confirm installed
              features, vehicle condition, and any remaining warranty with the
              team.
            </p>
            {Object.entries(v.equipment).map(([group, items]) => (
              <details className="equipment-group" key={group}>
                <summary>
                  {group}
                  <span>+</span>
                </summary>
                <ul>
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
          <section id="inquire" className="vehicle-inquiry">
            <div id="test-drive" className="anchor-target" />
            <p className="eyebrow">
              LESS BACK AND FORTH. MORE BEHIND THE WHEEL.
            </p>
            <h2>
              Let’s make
              <br />
              an introduction.
            </h2>
            <LeadForm
              kind="availability"
              vehicle={{ id: v.id, name: v.name }}
            />
          </section>
        </div>
        <aside className="vehicle-sidebar">
          <div className="purchase-panel">
            <span className="mono">YOUR NEXT MOVE</span>
            <h3>
              Some things are
              <br />
              better in person.
            </h3>
            <p>
              Get a closer look. Ask every question. See how it feels from the
              driver’s seat.
            </p>
            <ButtonLink href="#test-drive">Request a test drive</ButtonLink>
            <div className="purchase-contact">
              <a href={site.phoneHref}>
                <Phone size={17} />
                Call the team
              </a>
              <Link href="/contact-us/text">
                <MessageSquare size={17} />
                Text us
              </Link>
            </div>
            <span className="small muted">
              MIDVALE, UTAH · MON–SAT 10AM–7PM
            </span>
          </div>
          <section id="payment">
            <PaymentCalculator
              price={v.price || 30000}
              vehicleId={v.id}
              compact
            />
          </section>
          <Link href="/sell-your-vehicle" className="trade-prompt">
            <div>
              <span className="mono">TRADING UP?</span>
              <h3>
                Your current car
                <br />
                is a great start.
              </h3>
            </div>
            <ArrowUpRight size={24} />
          </Link>
        </aside>
      </div>
      <section className="related-section section">
        <div className="section-heading">
          <h2>Keep the possibilities open.</h2>
          <ButtonLink href="/inventory" variant="text">
            Explore inventory
          </ButtonLink>
        </div>
        <div className="vehicle-grid">
          {similar.map((item) => (
            <VehicleCard key={item.id} vehicle={item} />
          ))}
        </div>
      </section>
      <div className="mobile-purchase-bar">
        <div>
          <span className="mono">{v.model}</span>
          <strong>{v.price ? money(v.price) : "Call for price"}</strong>
        </div>
        <a href="#inquire" className="button button--gold">
          Make it yours <ArrowUpRight size={17} />
        </a>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Car",
            name: v.name,
            image: v.images,
            vehicleIdentificationNumber: v.vin,
            modelDate: String(v.year),
            ...(v.mileage > 0
              ? {
                  mileageFromOdometer: {
                    "@type": "QuantitativeValue",
                    value: v.mileage,
                    unitCode: "SMI",
                  },
                }
              : {}),
            ...(v.price > 0
              ? {
                  offers: {
                    "@type": "Offer",
                    price: v.price,
                    priceCurrency: "USD",
                    availability: "https://schema.org/InStock",
                    url: (process.env.SITE_URL || "") + vehicleHref(v),
                  },
                }
              : {}),
          }).replace(/</g, "\\u003c"),
        }}
      />
      <Motion />
    </>
  );
}
