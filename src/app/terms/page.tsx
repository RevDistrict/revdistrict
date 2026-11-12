import { Motion } from "@/components/motion";
import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";
export const metadata: Metadata = { title: "Terms & Conditions" };
export default function TermsPage() {
  return (
    <section className="legal-page section" data-motion-section>
      <p className="eyebrow">SMS TERMS</p>
      <h1>Terms &amp; Conditions.</h1>
      <p className="legal-intro">
        These terms govern the Rev District SMS program operated by Rev District
        LLC, doing business as Rev District.
      </p>
      <article>
        <h2>Program Description</h2>
        <p>
          Customers who opt in may receive text messages from Rev District
          concerning vehicle inquiries, vehicle availability, test-drive
          scheduling, appointment confirmations and reminders, and related
          customer support. Messages may be automated or sent by dealership
          representatives.
        </p>
        <h2>Consent</h2>
        <p>
          SMS participation is optional. Customers can opt in using the separate
          SMS consent checkbox on our website’s inquiry and test-drive forms.
          Consent is not a condition of purchasing a vehicle. Accepting general
          website terms alone does not enroll you in text messages.
        </p>
        <h2>Message Frequency and Charges</h2>
        <p>
          Message frequency varies based on your inquiries, appointments, and
          conversations with our team. Message and data rates may apply.
        </p>
        <h2>Opting Out</h2>
        <p>
          Reply STOP to unsubscribe. You may receive a confirmation message,
          after which no further messages will be sent through this program
          unless you opt in again.
        </p>
        <h2>Help and Customer Support</h2>
        <p>
          Reply HELP for assistance, call{" "}
          <a href={site.phoneHref}>{site.phone}</a>, or email{" "}
          <a href={`mailto:${site.email}`}>{site.email}</a>.
        </p>
        <h2>Carrier Disclaimer</h2>
        <p>Carriers are not liable for delayed or undelivered messages.</p>
        <h2>Privacy</h2>
        <p>
          Please review our <Link href="/privacy-policy">Privacy Policy</Link>{" "}
          for information about how we handle personal information.
        </p>
        <h2>Contact</h2>
        <p>
          Rev District LLC
          <br />
          {site.address}
          <br />
          {site.city}
          <br />
          Phone: <a href={site.phoneHref}>{site.phone}</a>
          <br />
          Email: <a href={`mailto:${site.email}`}>{site.email}</a>
        </p>
      </article>
      <Motion />
    </section>
  );
}
