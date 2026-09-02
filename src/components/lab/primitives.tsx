"use client";

import { useEffect, useRef, useState } from "react";
import type { Light } from "@/lib/analytics/benchmarks";

export const LIGHT_HEX: Record<Light, string> = {
  green: "#00D47E", yellow: "#FFB020", red: "#FF4D3D", black: "#4A4744",
};
export const LIGHT_GLYPH: Record<Light, string> = {
  green: "🟢", yellow: "🟡", red: "🔴", black: "⚫",
};

/**
 * Fallback for browsers without scroll-driven animations (Firefox stable, as
 * of 152, still has them behind a flag). Sets --fill once the row is visible;
 * the CSS transition does the rest. Where `animation-timeline: view()` IS
 * supported the CSS class takes over and this value is simply the end state.
 */
export function useBarFill(ratio: number | null) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollDriven, setScrollDriven] = useState(false);

  useEffect(() => {
    setScrollDriven(
      typeof CSS !== "undefined" && CSS.supports?.("animation-timeline", "view()")
    );
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || ratio === null) return;

    // Where scroll-driven animations exist, CSS reads --fill-target directly
    // and the scroll timeline does the reveal. Nothing to do here.
    if (CSS.supports?.("animation-timeline", "view()")) return;

    const target = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--fill", target);
      return;
    }

    // Fallback path only: reveal on intersection so the width transition runs.
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        el.style.setProperty("--fill", target);
        io.disconnect();
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ratio]);

  return { ref, scrollDriven };
}

export function Bar({ ratio, light }: { ratio: number | null; light: Light }) {
  const { ref, scrollDriven } = useBarFill(ratio);
  if (ratio === null) {
    return (
      <div className="lab-bar is-unmeasured" title="Sin medición" aria-label="Sin medición" />
    );
  }
  return (
    <div className="lab-bar">
      <div
        ref={ref}
        className={`lab-bar__fill${scrollDriven ? " is-scrolldriven" : ""}`}
        style={{
          ["--bar-color" as string]: LIGHT_HEX[light],
          // Rendered server-side: the bar is already correct in the HTML.
          ["--fill-target" as string]: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
        }}
      />
    </div>
  );
}

/** 20-block monospaced bar — the brief's exact spec, kept as a text fallback. */
export function BlockBar({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <span style={{ opacity: 0.35 }}>{"·".repeat(20)}</span>;
  const filled = Math.max(0, Math.min(20, Math.round(ratio * 20)));
  return <span>{"█".repeat(filled)}{"░".repeat(20 - filled)}</span>;
}

export function LightBadge({ light, reason }: { light: Light; reason?: string }) {
  return (
    <span className="light" data-light={light} title={reason}>
      <span className="light__dot" />
    </span>
  );
}

/** Pure-CSS count-up. Falls back to plain text where @property is unsupported. */
export function Odometer({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(
      typeof CSS !== "undefined" &&
      CSS.supports?.("(--x: 0)") &&
      CSS.registerProperty !== undefined
    );
  }, []);

  if (value === null) return <span style={{ opacity: 0.4 }}>—</span>;
  if (!supported) return <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}{suffix}</span>;
  return (
    <>
      <span className="odometer" style={{ ["--num" as string]: Math.round(value) }} aria-label={String(value)} />
      {suffix}
    </>
  );
}

export function ScoreRing({
  score, light, confidence,
}: { score: number | null; light: Light; confidence: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || score === null) return;
    // Next frame so the transition on --deg has a start value to run from.
    const id = requestAnimationFrame(() => {
      el.style.setProperty("--deg", `${(score / 100) * 360}deg`);
      el.style.setProperty("--glow", light === "green" ? "1" : "0.4");
    });
    return () => cancelAnimationFrame(id);
  }, [score, light]);

  return (
    <div ref={ref} className="score-ring" style={{ ["--ring-color" as string]: LIGHT_HEX[light] }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2.9rem", lineHeight: 1, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
          {score === null ? "—" : <Odometer value={score} />}
        </div>
        <div className="t-mono" style={{ opacity: 0.5, marginTop: 6 }}>score</div>
        <div className="t-mono" style={{ opacity: 0.4, fontSize: "9px", marginTop: 2 }}>
          conf. {confidence}
        </div>
      </div>
    </div>
  );
}
