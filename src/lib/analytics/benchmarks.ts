/**
 * TRAFFIC LAB — BENCHMARKS AND SEMÁFORO
 * ---------------------------------------------------------------------------
 * These are DEFAULTS, not law. They are industry-typical starting points for
 * paid landing traffic. Override them per client once you have 3-4 weeks of
 * that client's own history — a B2B SaaS demo page and a nightlife event page
 * do not share a bounce benchmark.
 *
 * The colour rule is deliberately strict:
 *   🟢 attainment >= 70% of benchmark
 *   🟡 40% - 69.9%
 *   🔴 < 40%, OR a critical break (0 fires, EMQ < 5, dedup mismatch > 30%)
 *   ⚫ NO MEASUREMENT — never a colour, never a guess
 *
 * ⚫ existing as a first-class state is the point. A dashboard that paints a
 * red light over a metric it cannot measure teaches the client to distrust
 * every other light on the page.
 */

export type Light = "green" | "yellow" | "red" | "black";

export type Direction = "higher" | "lower" | "range";

export interface Benchmark {
  key: string;
  label: string;
  /** Target value. For `range`, this is the lower bound. */
  target: number;
  /** Upper bound, `range` only. */
  targetMax?: number;
  direction: Direction;
  unit: "pct" | "ms" | "score" | "ratio";
  /** Below this, the metric is a critical break -> forced red. */
  criticalBelow?: number;
  note: string;
}

/** Declared defaults. Shown as "default" in the UI, never as ground truth. */
export const BENCHMARKS: Record<string, Benchmark> = {
  lcp:            { key: "lcp",            label: "LCP",                  target: 2500, direction: "lower",  unit: "ms",    note: "Core Web Vitals: bueno < 2.5s" },
  bouncePaid:     { key: "bouncePaid",     label: "Bounce (paid)",        target: 55,   direction: "lower",  unit: "pct",   note: "Paid landing típico < 55%" },
  scroll50:       { key: "scroll50",       label: "Scroll 50",            target: 45,   direction: "higher", unit: "pct",   note: "≥45% de UU" },
  scroll75:       { key: "scroll75",       label: "Scroll 75",            target: 28,   direction: "higher", unit: "pct",   note: "≥28% de UU" },
  time15:         { key: "time15",         label: "Tiempo ≥15s",          target: 35,   direction: "higher", unit: "pct",   note: "≥35% de UU, sobre tiempo ACTIVO" },
  qualityVisit:   { key: "qualityVisit",   label: "Quality Visit",        target: 25,   direction: "higher", unit: "pct",   note: "≥15s Y ≥50% scroll" },
  ctaView:        { key: "ctaView",        label: "CTA visto",            target: 60,   direction: "higher", unit: "pct",   note: "≥60% de UU llega a ver un CTA" },
  ctaClickRate:   { key: "ctaClickRate",   label: "CTA click/view",       target: 8, targetMax: 15, direction: "range", unit: "pct", note: "8-15% sobre los que LO VEN" },
  formCompletion: { key: "formCompletion", label: "Form start→submit",    target: 30,   direction: "higher", unit: "pct",   note: "≥30%" },
  emq:            { key: "emq",            label: "EMQ",                  target: 7,    direction: "higher", unit: "score", criticalBelow: 5, note: "≥7.0 · <5 es rotura crítica" },
  dedup:          { key: "dedup",          label: "Dedup Pixel↔CAPI",     target: 80,   direction: "higher", unit: "pct",   criticalBelow: 70, note: "≥80% · mismatch >30% es rotura" },
  pageViewRatio:  { key: "pageViewRatio",  label: "PageView events/UU",   target: 1.0, targetMax: 1.3, direction: "range", unit: "ratio", note: "1.0-1.3 · fuera de rango = doble disparo o pérdida" },
};

/**
 * Attainment: how much of the benchmark this value achieves, 0..1+.
 * `null` in -> `null` out. Never substitute zero for missing data: a metric
 * that was never measured is not a metric that scored zero.
 */
export function attainment(value: number | null | undefined, b: Benchmark): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;

  if (b.direction === "higher") {
    return b.target === 0 ? 1 : value / b.target;
  }
  if (b.direction === "lower") {
    // At or under target = full marks; degrades from there.
    if (value <= b.target) return 1;
    return Math.max(0, b.target / value);
  }
  // range: inside the band is perfect, outside degrades by distance
  const lo = b.target;
  const hi = b.targetMax ?? b.target;
  if (value >= lo && value <= hi) return 1;
  if (value < lo) return lo === 0 ? 0 : value / lo;
  return hi === 0 ? 0 : Math.max(0, hi / value);
}

export interface Verdict {
  light: Light;
  attainment: number | null;
  /** Human reason, used in tooltips and in the diagnosis section. */
  reason: string;
}

export function verdict(
  value: number | null | undefined,
  b: Benchmark,
  opts: { fires?: number | null } = {}
): Verdict {
  // ⚫ No measurement. This is not a failure state, it is an unknown state.
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { light: "black", attainment: null, reason: "Sin medición — falta instrumentación o datos" };
  }

  // 🔴 Critical breaks short-circuit the percentage logic entirely.
  if (opts.fires === 0) {
    return { light: "red", attainment: 0, reason: "0 disparos — el evento no existe o está roto" };
  }
  if (b.criticalBelow !== undefined && value < b.criticalBelow) {
    return { light: "red", attainment: attainment(value, b), reason: `Rotura crítica: por debajo de ${b.criticalBelow}` };
  }

  const a = attainment(value, b)!;
  if (a >= 0.7) return { light: "green",  attainment: a, reason: `${(a * 100).toFixed(0)}% del benchmark` };
  if (a >= 0.4) return { light: "yellow", attainment: a, reason: `${(a * 100).toFixed(0)}% del benchmark` };
  return { light: "red", attainment: a, reason: `${(a * 100).toFixed(0)}% del benchmark` };
}

export const LIGHT_GLYPH: Record<Light, string> = {
  green: "🟢", yellow: "🟡", red: "🔴", black: "⚫",
};

export const LIGHT_HEX: Record<Light, string> = {
  green: "#00D47E", yellow: "#FFB020", red: "#FF4D3D", black: "#4A4744",
};

/**
 * 20-block monospaced progress bar. `null` renders as unmeasured, never empty —
 * an empty bar reads as "zero", and zero is a claim we have not earned.
 */
export function bar(ratio: number | null | undefined, blocks = 20): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "·".repeat(blocks);
  const filled = Math.max(0, Math.min(blocks, Math.round(ratio * blocks)));
  return "█".repeat(filled) + "░".repeat(blocks - filled);
}

export const pct = (n: number | null | undefined, dp = 1): string =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : `${n.toFixed(dp)}%`;

export const int = (n: number | null | undefined): string =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : Math.round(n).toLocaleString("es-ES");

export const ms = (n: number | null | undefined): string =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : n < 1000 ? `${Math.round(n)}ms` : `${(n / 1000).toFixed(1)}s`;
