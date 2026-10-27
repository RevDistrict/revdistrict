"use client";
import { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Vehicle, DriveMode } from "@/lib/vehicle";
import { driveModes, matchesMode } from "@/lib/vehicle";
import { ButtonLink } from "./ui";
import { VehicleCard } from "./vehicle-card";
export function DriveSelector({ vehicles }: { vehicles: Vehicle[] }) {
  const [mode, setMode] = useState<DriveMode>("all");
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.fromTo(
          ".dial-orbit",
          { rotation: -8, y: 25 },
          {
            rotation: 9,
            y: -15,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top bottom",
              end: "center top",
              scrub: 1.2,
            },
          },
        );
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);
  const matches = vehicles.filter((v) => matchesMode(v, mode));
  const curated = ["1173076", "1133320", "1187817"];
  const sorted =
    mode === "all"
      ? [...matches].sort((a, b) => {
          const ia = curated.indexOf(a.id),
            ib = curated.indexOf(b.id);
          return (ia === -1 ? 100 : ia) - (ib === -1 ? 100 : ib);
        })
      : matches;
  const degrees = { all: -105, performance: 100, adventure: 28, everyday: -35 };
  const labels = {
    all: "ALL DRIVES",
    performance: "SPORT",
    adventure: "EXPLORE",
    everyday: "EVERYDAY",
  };
  return (
    <section
      ref={root}
      className="section inventory-feature"
      id="find-your-drive"
    >
      <div className="drive-heading">
        <div className="drive-copy">
          <p className="eyebrow">A CONNECTION. NOT JUST A COMMUTE.</p>
          <h2 data-reveal>
            Find your
            <br />
            <span data-sheen>frequency.</span>
          </h2>
          <p>Start with your kind of drive.</p>
          <span className="drive-caption mono">
            SELECT A MOOD. MEET YOUR MATCH.
          </span>
        </div>
        <div className="dial-stage" aria-hidden="true">
          <div className="dial-orbit">
            <div className="drive-dial">
              <svg viewBox="0 0 500 500">
                <circle className="dial-outer" cx="250" cy="250" r="245" />
                <circle className="dial-bezel" cx="250" cy="250" r="234" />
                <circle className="dial-inner" cx="250" cy="250" r="224" />
                {Array.from({ length: 91 }, (_, i) => {
                  return (
                    <line
                      key={i}
                      x1="250"
                      y1="42"
                      x2="250"
                      y2={i % 10 === 0 ? 73 : i % 5 === 0 ? 63 : 53}
                      transform={`rotate(${i * 3 - 135} 250 250)`}
                      className={
                        i > 72
                          ? "dial-hot"
                          : i % 10 === 0
                            ? "dial-major"
                            : "dial-tick"
                      }
                    />
                  );
                })}
                {Array.from({ length: 10 }, (_, i) => {
                  const a = ((i * 30 - 225) * Math.PI) / 180;
                  return (
                    <text
                      key={i}
                      x={(250 + 156 * Math.cos(a)).toFixed(3)}
                      y={(257 + 156 * Math.sin(a)).toFixed(3)}
                      className="dial-number"
                      textAnchor="middle"
                    >
                      {i}
                    </text>
                  );
                })}
                <text
                  x="250"
                  y="177"
                  textAnchor="middle"
                  className="dial-brand"
                >
                  REV / DISTRICT
                </text>
                <g
                  className="dial-hand"
                  style={{
                    transform: `rotate(${degrees[mode]}deg)`,
                    transformOrigin: "250px 250px",
                  }}
                >
                  <path
                    d="M 245 275 L 248 66 L 253 66 L 256 275 Z"
                    className="dial-needle"
                  />
                </g>
                <circle cx="250" cy="250" r="17" className="dial-hub" />
                <circle cx="250" cy="250" r="8" className="dial-hub-inner" />
                <text x="250" y="331" textAnchor="middle" className="dial-mode">
                  {labels[mode]}
                </text>
              </svg>
            </div>
          </div>
          <span className="dial-annotation mono">
            <i /> TUNED TO YOU.
          </span>
        </div>
      </div>
      <div className="drive-toolbar">
        <div className="drive-tabs" role="group" aria-label="Choose your drive">
          {driveModes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
            >
              {item.label}
              <span>
                {vehicles.filter((v) => matchesMode(v, item.id)).length}
              </span>
            </button>
          ))}
        </div>
        <ButtonLink
          href={`/inventory${mode === "all" ? "" : `?mode=${mode}`}`}
          variant="text"
        >
          View collection
        </ButtonLink>
      </div>
      <div className="vehicle-grid featured-grid" aria-live="polite">
        {sorted.slice(0, 3).map((v) => (
          <VehicleCard key={v.id} vehicle={v} />
        ))}
        {!sorted.length && (
          <p className="collection-empty">
            Something new is always around the corner. Explore all drives or
            talk with the team.
          </p>
        )}
      </div>
    </section>
  );
}
