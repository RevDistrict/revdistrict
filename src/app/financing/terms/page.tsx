import { Motion } from "@/components/motion";
import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
export const metadata: Metadata = { title: "Credit Application Terms" };
export default function FinanceTerms() {
  return (
    <section className="legal-page section" data-motion-section>
      <p className="eyebrow">KNOW WHAT YOU’RE AGREEING TO</p>
      <h1>Application terms.</h1>
      <p className="legal-intro">
        Please review this information before submitting a credit application.
        The application contains the dealership’s current terms and
        authorizations.
      </p>
      <article>
        <h2>Review the application’s terms</h2>
        <p>
          The Used Car Factory’s credit application is provided through
          dealr.cloud. Review its disclosures, privacy information and
          authorizations before entering and submitting your information. Those
          terms are displayed within the application itself.
        </p>
        <h2>What happens after you apply</h2>
        <p>
          The dealership and its approved financing providers review the
          information you submit. They may request documents or contact you to
          verify details. An application, payment estimate or confirmation of
          receipt is not a financing approval, rate offer, reservation or
          purchase agreement. Available programs and terms depend on review of
          your application and the vehicle.
        </p>
        <h2>Information used for your application</h2>
        <p>
          The application requests contact and identity details, residence and
          employment history, income, and optional vehicle and trade-in
          information. When authorized, consumer reports and verification
          information may also be used to assess financing. See our{" "}
          <Link href="/privacy-policy">privacy notice</Link> for information
          about website data handling and contact the dealership for its
          financial privacy disclosures.
        </p>
        <h2>Joint applications</h2>
        <p>
          Choose a joint application only when both people intend to apply
          together. The co-applicant should enter their own information and
          provide their own authorization. Do not submit another person’s
          information without their participation and consent.
        </p>
        <h2>Communication and corrections</h2>
        <p>
          The team may contact you about your application. If you need to
          correct information or are unsure whether an application was received,
          call <a href={site.phoneHref}>{site.phone}</a> before submitting
          again. Do not email Social Security numbers or other sensitive
          financial information.
        </p>
        <Link className="button button--gold" href="/financing/apply">
          Go to the application
        </Link>
      </article>
      <Motion />
    </section>
  );
}
