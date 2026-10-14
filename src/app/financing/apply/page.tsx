import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getInventory } from "@/lib/inventory";
import { site } from "@/lib/site";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Credit Application",
  robots: { index: false, follow: true },
};
export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ entry_id?: string }>;
}) {
  const query = await searchParams;
  let selected: { name: string } | undefined;
  if (query.entry_id) {
    try {
      selected = (await getInventory()).vehicles.find(
        (v) => v.id === query.entry_id,
      );
    } catch {
      /* An inventory outage must not prevent an application. */
    }
  }
  return (
    <section className="section application-page">
      <Link className="application-back mono" href="/financing">
        <ArrowLeft size={15} /> Back to financing
      </Link>
      <div className="application-intro">
        <div>
          <p className="eyebrow">THE NEXT STEP, TOGETHER</p>
          <h1>
            A plan for
            <br />
            <span className="gold">your next car.</span>
          </h1>
        </div>
        <p>
          Complete your application right here. We’ll help you explore financing
          for your situation, from established credit to buy here, pay here.
        </p>
      </div>
      <div className="credit-application">
        <div className="credit-application-note">
          <p>
            Apply directly with The Used Car Factory through dealr.cloud. Review
            the terms and authorizations in the application before submitting.
          </p>
          {selected && (
            <p>
              Interested in the <strong>{selected.name}</strong>? Choose that
              vehicle in the application below.
            </p>
          )}
          <a
            href={site.creditApplicationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open application in a new tab <span aria-hidden="true">↗</span>
          </a>
        </div>
        <iframe
          className="credit-application-frame"
          src={site.creditApplicationUrl}
          title="Credit Application"
          referrerPolicy="no-referrer"
        />
        <p className="credit-application-help">
          Need help applying? Call <a href={site.phoneHref}>{site.phone}</a>. If
          the form doesn’t load here, use the link above to open it directly.
        </p>
      </div>
    </section>
  );
}
