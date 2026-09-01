/**
 * DYNAMIC BEHAVIOURAL LEAD SCORING
 * ---------------------------------------------------------------------------
 * Pure functions, no I/O. Shared verbatim by the browser (so the visitor's own
 * live report matches) and the server (so the dashboard and CAPI agree).
 *
 * Four dimensions, capped independently so no single behaviour can run away:
 *
 *   INTENT    0-40  Did they behave like someone about to buy?
 *   ENGAGE    0-25  Did they actually consume the content?
 *   FIT       0-20  Do their declared assets match our ICP?
 *   IDENTITY  0-15  How resolvable are they?
 *
 * Total 0-100 -> temperature band -> routing decision.
 */

import { getSectionWeight, getSpec } from "./taxonomy";
import type { Temperature } from "./types";

export const CAPS = { intent: 40, engage: 25, fit: 20, identity: 15 } as const;

export const THRESHOLDS: Record<Temperature, number> = {
  COLD: 0,
  WARM: 25,
  HOT: 50,
  MQL: 75,
  SQL: 90,
};

export interface ScoringInput {
  /** Aggregated counters from the Visitor row. */
  totalActiveMs: number;
  maxScrollDepth: number;
  sessionCount: number;
  pricingViews: number;
  ctaHovers: number;
  ctaClicks: number;
  formStarts: number;
  formAbandons: number;
  rageClicks: number;
  exitIntents: number;
  videoCompletions: number;
  identityStage: string;
  /** Section id -> total dwell ms across all sessions. */
  sectionDwell: Record<string, number>;
  /** Declared fit attributes from onboarding. */
  hasWebsite?: boolean;
  hasMetaAccess?: boolean;
  hasGoogleBusiness?: boolean;
  budgetBand?: string | null;
}

export interface ScoreResult {
  score: number;
  temperature: Temperature;
  breakdown: { intent: number; engage: number; fit: number; identity: number };
  signals: string[];
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(Math.round(n), max));

export function scoreVisitor(i: ScoringInput): ScoreResult {
  const signals: string[] = [];

  // ---- INTENT (0-40) ------------------------------------------------------
  let intent = 0;

  // Scroll depth is the cheapest honest intent proxy.
  if (i.maxScrollDepth >= 90) { intent += 8; signals.push("read_to_end"); }
  else if (i.maxScrollDepth >= 75) intent += 5;
  else if (i.maxScrollDepth >= 50) intent += 3;
  else if (i.maxScrollDepth >= 25) intent += 1;

  // Weighted section attention. Pricing dwell is the single strongest signal.
  let weightedDwellPts = 0;
  for (const [sectionId, ms] of Object.entries(i.sectionDwell)) {
    const { dwellMs, multiplier } = getSectionWeight(sectionId);
    if (ms >= dwellMs) weightedDwellPts += 2 * multiplier;
    if (ms >= dwellMs * 2.5) weightedDwellPts += 1.5 * multiplier;
  }
  intent += Math.min(weightedDwellPts, 14);

  // Repeat pricing views = active comparison shopping.
  if (i.pricingViews >= 3) { intent += 7; signals.push("price_obsession"); }
  else if (i.pricingViews === 2) { intent += 4; signals.push("price_revisit"); }
  else if (i.pricingViews === 1) intent += 2;

  // Declared micro-commitments.
  intent += Math.min(i.ctaClicks * 4, 8);
  intent += Math.min(i.ctaHovers * 1.5, 4);
  if (i.formStarts > 0) { intent += 4; signals.push("form_started"); }

  // Returning visitors convert at a multiple of first-touch visitors.
  if (i.sessionCount >= 3) { intent += 6; signals.push("multi_session"); }
  else if (i.sessionCount === 2) { intent += 3; signals.push("returned"); }

  // Exit intent AFTER deep engagement is intent, not rejection.
  if (i.exitIntents > 0 && i.maxScrollDepth >= 60) signals.push("exit_intent_deep");

  intent = clamp(intent, CAPS.intent);

  // ---- ENGAGE (0-25) ------------------------------------------------------
  let engage = 0;
  const activeMin = i.totalActiveMs / 60000;

  // Active time only — idle and background tabs never counted.
  if (activeMin >= 8) { engage += 12; signals.push("deep_reader"); }
  else if (activeMin >= 4) engage += 9;
  else if (activeMin >= 2) engage += 6;
  else if (activeMin >= 1) engage += 3;
  else if (activeMin >= 0.5) engage += 1;

  engage += Math.min(i.videoCompletions * 4, 8);

  // Breadth of attention: how many distinct sections got real dwell.
  const engagedSections = Object.entries(i.sectionDwell)
    .filter(([id, ms]) => ms >= getSectionWeight(id).dwellMs).length;
  engage += Math.min(engagedSections * 1.5, 5);
  if (engagedSections >= 6) signals.push("full_journey");

  engage = clamp(engage, CAPS.engage);

  // ---- FIT (0-20) ---------------------------------------------------------
  let fit = 0;
  if (i.hasWebsite) { fit += 5; signals.push("has_website"); }
  if (i.hasMetaAccess) { fit += 7; signals.push("meta_assets"); }
  if (i.hasGoogleBusiness) { fit += 5; signals.push("gbp_assets"); }
  if (i.budgetBand && i.budgetBand !== "under_1k") fit += 3;
  fit = clamp(fit, CAPS.fit);

  // ---- IDENTITY (0-15) ----------------------------------------------------
  const identityPts: Record<string, number> = {
    anonymous: 0, consented: 5, identified: 9, authenticated: 12, client: 15,
  };
  const identity = clamp(identityPts[i.identityStage] ?? 0, CAPS.identity);
  if (i.identityStage === "authenticated" || i.identityStage === "client") {
    signals.push("identity_resolved");
  }

  // ---- PENALTIES ----------------------------------------------------------
  let penalty = 0;
  if (i.rageClicks >= 3) { penalty += 3; signals.push("friction_detected"); }
  if (i.formAbandons > 0 && i.formStarts > 0) { penalty += 2; signals.push("form_abandoned"); }

  const score = Math.max(0, Math.min(100, intent + engage + fit + identity - penalty));

  return {
    score,
    temperature: temperatureFor(score),
    breakdown: { intent, engage, fit, identity },
    signals: [...new Set(signals)],
  };
}

export function temperatureFor(score: number): Temperature {
  if (score >= THRESHOLDS.SQL) return "SQL";
  if (score >= THRESHOLDS.MQL) return "MQL";
  if (score >= THRESHOLDS.HOT) return "HOT";
  if (score >= THRESHOLDS.WARM) return "WARM";
  return "COLD";
}

/** What the team should actually do about this lead, right now. */
export function routingFor(t: Temperature): { action: string; sla: string; channel: string } {
  switch (t) {
    case "SQL":  return { action: "Llamada directa del CEO", sla: "< 15 min", channel: "WhatsApp + llamada" };
    case "MQL":  return { action: "Mensaje personal 1:1 con referencia a su comportamiento", sla: "< 1 h", channel: "WhatsApp" };
    case "HOT":  return { action: "Secuencia de nutrición agresiva + retargeting 1:1", sla: "< 4 h", channel: "WhatsApp + Ads" };
    case "WARM": return { action: "Retargeting de contenido + email de valor", sla: "< 24 h", channel: "Ads + Email" };
    default:     return { action: "Audiencia de awareness, sin contacto humano", sla: "—", channel: "Ads" };
  }
}

/** Points a single event contributes in isolation — used for the live widget. */
export function eventPoints(name: string): number {
  const spec = getSpec(name);
  if (!spec || spec.scoreDim === "none") return 0;
  return spec.weight;
}
