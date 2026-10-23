import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
export function ButtonLink({
  href,
  children,
  variant = "gold",
  className = "",
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant?: "gold" | "outline" | "text";
  className?: string;
  external?: boolean;
}) {
  const Component = href.startsWith("#") ? "a" : Link;
  return (
    <Component
      href={href}
      className={`button button--${variant} ${className}`}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span>{children}</span>
      {external ? <ArrowUpRight size={18} /> : <ArrowRight size={18} />}
    </Component>
  );
}
export function SectionHeading({
  title,
  children,
}: {
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2 data-reveal>{title}</h2>
      {children}
    </div>
  );
}
export function CornerMark() {
  return (
    <span className="corner-mark" aria-hidden="true">
      ↗
    </span>
  );
}
