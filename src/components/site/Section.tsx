"use client";

import type { ReactNode } from "react";

/**
 * Every section is a tracking unit. `id` is both the anchor and the taxonomy
 * key used by SECTION_WEIGHTS — one identifier, so a section can never be
 * measured under a name the scoring engine does not know about.
 */
export function Section({
  id, children, theme = "dark", className = "", grid = true, order,
}: {
  id: string;
  children: ReactNode;
  theme?: "dark" | "light";
  className?: string;
  grid?: boolean;
  order?: number;
}) {
  return (
    <section
      id={id}
      data-track-section={id}
      data-track-order={order}
      data-theme={theme}
      className={`relative isolate ${className}`}
      style={{
        background: theme === "light" ? "var(--color-cream)" : "var(--color-ink)",
        color: theme === "light" ? "var(--color-ink)" : "var(--color-cream)",
      }}
    >
      {grid && (
        <div className="grid-lines" aria-hidden>
          <span /><span /><span /><span />
        </div>
      )}
      <div className="shell relative z-10">{children}</div>
    </section>
  );
}

export function SectionLabel({ index, children }: { index: string; children: ReactNode }) {
  return (
    <div className="t-mono flex items-center gap-3 opacity-60">
      <span className="blue">{index}</span>
      <span className="h-px w-8" style={{ background: "var(--line)" }} />
      <span>{children}</span>
    </div>
  );
}
