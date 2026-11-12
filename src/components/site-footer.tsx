import Link from "next/link";
import { ArrowUpRight, Camera, Play } from "lucide-react";
import { navigation, site } from "@/lib/site";
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <Link href="/" className="footer-brand" aria-label="RevDistrict home">
          <img
            src="/images/revdistrict-transparent.png"
            width="1536"
            height="1024"
            alt="RevDistrict"
            loading="lazy"
          />
        </Link>
        <div className="footer-links">
          {navigation.map((n) => (
            <Link href={n.href} key={n.href}>
              {n.label}
            </Link>
          ))}
          <Link href="/contact-us">Contact Us</Link>
        </div>
        <div className="footer-contact">
          <a href={site.phoneHref}>
            {site.phone}
            <ArrowUpRight size={16} />
          </a>
          <a href={site.maps} target="_blank" rel="noreferrer">
            {site.address}
            <br />
            {site.city}
          </a>
          <span className="mono">MON–SAT 10AM–7PM · SUNDAY CLOSED</span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} RevDistrict</span>
        <span className="rebrand-note">Rooted in Midvale, Utah.</span>
        <Link href="/terms">Terms &amp; Conditions</Link>
        <Link href="/privacy-policy">Privacy Policy</Link>
        <a
          href={site.instagram}
          target="_blank"
          rel="noreferrer"
          aria-label="RevDistrict on Instagram"
        >
          <Camera size={18} />
        </a>
        <a
          href={site.youtube}
          target="_blank"
          rel="noreferrer"
          aria-label="RevDistrict on YouTube"
        >
          <Play size={20} />
        </a>
      </div>
    </footer>
  );
}
