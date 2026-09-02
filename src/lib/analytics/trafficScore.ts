/**
 * TRAFFIC LAB — COMPOSITE SCORE 0-100
 * ---------------------------------------------------------------------------
 * Score = 0.20*(1-bounce) + 0.20*scroll50 + 0.15*time15
 *       + 0.15*cta_view  + 0.15*emq_norm + 0.15*conv_signal
 *
 * Every input is a 0..1 ratio. Missing inputs are NOT treated as zero — they
 * are excluded and the remaining weights are renormalised, and the response
 * reports exactly which components were measured. A score built on 3 of 6
 * components must announce itself as such, or it is a lie with a decimal point.
 */

export interface ScoreInputs {
  /** 0..1 — share of UU that bounced. */
  bounce: number | null;
  /** 0..1 — share of UU reaching 50% scroll. */
  scroll50: number | null;
  /** 0..1 — share of UU with >=15s active. */
  time15: number | null;
  /** 0..1 — share of UU that saw a CTA. */
  ctaView: number | null;
  /** 0..1 — EMQ / 10. */
  emqNorm: number | null;
  /** 0..1 — share of UU producing a real conversion signal (Lead / QualityVisit). */
  convSignal: number | null;
}

const WEIGHTS: { key: keyof ScoreInputs; w: number; label: string; invert?: boolean }[] = [
  { key: "bounce",     w: 0.20, label: "Retención (1-bounce)", invert: true },
  { key: "scroll50",   w: 0.20, label: "Scroll 50" },
  { key: "time15",     w: 0.15, label: "Tiempo ≥15s" },
  { key: "ctaView",    w: 0.15, label: "CTA visto" },
  { key: "emqNorm",    w: 0.15, label: "EMQ normalizado" },
  { key: "convSignal", w: 0.15, label: "Señal de conversión" },
];

export interface ScoreResult {
  score: number | null;
  /** Share of the formula's weight that was actually measurable, 0..1. */
  coverage: number;
  measured: string[];
  missing: string[];
  contributions: { label: string; weight: number; value: number | null; points: number | null }[];
  /** Honest label for the UI. */
  confidence: "alta" | "media" | "baja" | "sin datos";
}

export function trafficScore(i: ScoreInputs): ScoreResult {
  let weightUsed = 0;
  let weighted = 0;
  const measured: string[] = [];
  const missing: string[] = [];
  const contributions: ScoreResult["contributions"] = [];

  for (const { key, w, label, invert } of WEIGHTS) {
    const raw = i[key];
    if (raw === null || raw === undefined || Number.isNaN(raw)) {
      missing.push(label);
      contributions.push({ label, weight: w, value: null, points: null });
      continue;
    }
    const v = Math.max(0, Math.min(1, invert ? 1 - raw : raw));
    weightUsed += w;
    weighted += w * v;
    measured.push(label);
    contributions.push({ label, weight: w, value: v, points: Math.round(w * v * 100 * 10) / 10 });
  }

  if (weightUsed === 0) {
    return { score: null, coverage: 0, measured, missing, contributions, confidence: "sin datos" };
  }

  // Renormalise over measured weight so a partial dashboard is not penalised
  // for instrumentation it does not have yet.
  const score = Math.round((weighted / weightUsed) * 100);
  const coverage = weightUsed;

  const confidence: ScoreResult["confidence"] =
    coverage >= 0.85 ? "alta" : coverage >= 0.6 ? "media" : "baja";

  return { score, coverage, measured, missing, contributions, confidence };
}
