/**
 * UNIFIED EVENT TAXONOMY
 * ---------------------------------------------------------------------------
 * One naming convention across every channel. `category.action`, snake_case.
 * Each event declares, in one place:
 *   - weight    : business value 0..10 (feeds the scoring engine)
 *   - scoreDim  : which score dimension it moves
 *   - meta      : Meta Pixel + CAPI event name (standard events where possible)
 *   - ga4       : GA4 event name (snake_case, GA4 convention)
 *   - tiktok    : TikTok Events API name
 *   - serverSide: mirror to Conversions API (dedup via shared event_id)
 *
 * Adding a channel = adding a column here. Nothing else changes.
 */

export type ScoreDimension = "intent" | "engage" | "fit" | "identity" | "none";

export type EventCategory =
  | "page"
  | "scroll"
  | "section"
  | "block"
  | "cta"
  | "form"
  | "video"
  | "identity"
  | "lead"
  | "onboarding"
  | "friction"
  | "qualification";

export interface EventSpec {
  category: EventCategory;
  weight: number;
  scoreDim: ScoreDimension;
  meta?: string;
  ga4?: string;
  tiktok?: string;
  serverSide?: boolean;
  /** Fire at most once per session (dedup key = event name) */
  oncePerSession?: boolean;
  description: string;
}

export const EVENTS = {
  // ---- PAGE ---------------------------------------------------------------
  "page.view": {
    category: "page", weight: 1, scoreDim: "engage",
    meta: "PageView", ga4: "page_view", tiktok: "Pageview", serverSide: true,
    description: "Route entered (SPA-aware).",
  },
  "page.exit": {
    category: "page", weight: 0, scoreDim: "none", ga4: "page_exit",
    description: "Beacon on pagehide with final dwell + active time.",
  },
  "page.return_visit": {
    category: "page", weight: 6, scoreDim: "intent", ga4: "return_visit",
    meta: "ViewContent", oncePerSession: true,
    description: "Known visitor returning within the attribution window. High intent.",
  },

  // ---- SCROLL -------------------------------------------------------------
  "scroll.depth_25": {
    category: "scroll", weight: 1, scoreDim: "engage", ga4: "scroll", oncePerSession: true,
    description: "Reached 25% of document height.",
  },
  "scroll.depth_50": {
    category: "scroll", weight: 2, scoreDim: "engage", ga4: "scroll", oncePerSession: true,
    description: "Reached 50%.",
  },
  "scroll.depth_75": {
    category: "scroll", weight: 3, scoreDim: "intent", ga4: "scroll", oncePerSession: true,
    description: "Reached 75%. Correlates strongly with lead conversion.",
  },
  "scroll.depth_90": {
    category: "scroll", weight: 5, scoreDim: "intent",
    meta: "ViewContent", ga4: "scroll", tiktok: "ViewContent",
    serverSide: true, oncePerSession: true,
    description: "Read to the end. Retargeting-worthy on its own.",
  },
  "scroll.velocity_slow": {
    category: "scroll", weight: 2, scoreDim: "engage", ga4: "slow_read",
    description: "Sustained slow scroll over a content block = actual reading, not skimming.",
  },
  "scroll.backtrack": {
    category: "scroll", weight: 3, scoreDim: "intent", ga4: "scroll_backtrack",
    description: "Scrolled back up to re-read a section. Strong consideration signal.",
  },

  // ---- SECTION / BLOCK (the metadata absorption layer) --------------------
  "section.enter": {
    category: "section", weight: 1, scoreDim: "engage", ga4: "section_view",
    description: "Section crossed 50% visibility.",
  },
  "section.exit": {
    category: "section", weight: 0, scoreDim: "none", ga4: "section_exit",
    description: "Section left viewport. Carries dwellMs + maxVisibleRatio.",
  },
  "section.dwell": {
    category: "section", weight: 4, scoreDim: "intent",
    meta: "ViewContent", ga4: "section_dwell", tiktok: "ViewContent", serverSide: true,
    description: "Section held >= its dwell threshold. The core interest signal.",
  },
  "section.revisit": {
    category: "section", weight: 6, scoreDim: "intent", ga4: "section_revisit",
    description: "Same section entered 2+ times in one session. Comparison behaviour.",
  },
  "block.enter": {
    category: "block", weight: 0, scoreDim: "none", ga4: "block_view",
    description: "Granular block (card, pricing tier, FAQ row) became visible.",
  },
  "block.dwell": {
    category: "block", weight: 2, scoreDim: "intent", ga4: "block_dwell",
    description: "Block-level attention with dwell time and viewport position.",
  },
  "block.hover": {
    category: "block", weight: 2, scoreDim: "intent", ga4: "block_hover",
    description: "Sustained hover (>600ms) — desktop micro-intent.",
  },
  "block.expand": {
    category: "block", weight: 3, scoreDim: "intent", ga4: "block_expand",
    description: "FAQ / accordion opened. Objection being researched.",
  },

  // ---- CTA ----------------------------------------------------------------
  "cta.view": {
    category: "cta", weight: 1, scoreDim: "engage", ga4: "cta_view",
    description: "CTA entered viewport.",
  },
  "cta.hover": {
    category: "cta", weight: 3, scoreDim: "intent", ga4: "cta_hover",
    description: "Hovered a CTA without clicking. Hesitation = warm.",
  },
  "cta.click": {
    category: "cta", weight: 7, scoreDim: "intent",
    meta: "InitiateCheckout", ga4: "cta_click", tiktok: "ClickButton", serverSide: true,
    description: "Primary conversion intent.",
  },
  "cta.whatsapp_click": {
    category: "cta", weight: 8, scoreDim: "intent",
    meta: "Contact", ga4: "whatsapp_click", tiktok: "Contact", serverSide: true,
    description: "Opened WhatsApp. Highest-intent non-form action.",
  },

  // ---- FORM (field-level metadata, never field values) -------------------
  "form.start": {
    category: "form", weight: 5, scoreDim: "intent", ga4: "form_start", meta: "InitiateCheckout",
    description: "First field focused.",
  },
  "form.field_focus": {
    category: "form", weight: 1, scoreDim: "engage", ga4: "form_field_focus",
    description: "Field entered. Metadata only: name, index, timeToReachMs.",
  },
  "form.field_complete": {
    category: "form", weight: 2, scoreDim: "engage", ga4: "form_field_complete",
    description: "Field left with a valid value. Carries fillMs, length, corrections, pasted.",
  },
  "form.field_error": {
    category: "form", weight: 0, scoreDim: "none", ga4: "form_field_error",
    description: "Validation failed. Friction telemetry.",
  },
  "form.hesitation": {
    category: "form", weight: 0, scoreDim: "none", ga4: "form_hesitation",
    description: "Field focused >8s with no input. Marks the friction field.",
  },
  "form.abandon": {
    category: "form", weight: 0, scoreDim: "none", ga4: "form_abandon",
    description: "Form started, never submitted. Retargeting trigger.",
  },
  "form.submit": {
    category: "form", weight: 9, scoreDim: "intent",
    meta: "Lead", ga4: "generate_lead", tiktok: "SubmitForm", serverSide: true,
    description: "Form submitted successfully.",
  },

  // ---- VIDEO --------------------------------------------------------------
  "video.start": {
    category: "video", weight: 2, scoreDim: "engage", ga4: "video_start",
    description: "Playback started.",
  },
  "video.progress_50": {
    category: "video", weight: 3, scoreDim: "engage", ga4: "video_progress",
    description: "Half watched.",
  },
  "video.complete": {
    category: "video", weight: 5, scoreDim: "intent",
    meta: "ViewContent", ga4: "video_complete", serverSide: true,
    description: "Watched to the end.",
  },

  // ---- IDENTITY -----------------------------------------------------------
  "identity.gate_shown": {
    category: "identity", weight: 0, scoreDim: "none", ga4: "consent_gate_shown",
    description: "Post-first-scroll consent modal displayed.",
  },
  "identity.consent_granted": {
    category: "identity", weight: 6, scoreDim: "identity",
    meta: "ConsentGranted", ga4: "consent_granted", serverSide: true,
    description: "Visitor authorised personalised behavioural tracking.",
  },
  "identity.consent_declined": {
    category: "identity", weight: 0, scoreDim: "none", ga4: "consent_declined",
    description: "Declined. Collection drops to anonymous aggregate only.",
  },
  "identity.google_login": {
    category: "identity", weight: 10, scoreDim: "identity",
    meta: "CompleteRegistration", ga4: "login", tiktok: "CompleteRegistration", serverSide: true,
    description: "Authenticated with Google. Identity resolved, PII available for CAPI match.",
  },

  // ---- LEAD ---------------------------------------------------------------
  "lead.widget_shown": {
    category: "lead", weight: 0, scoreDim: "none", ga4: "lead_widget_shown",
    description: "End-of-scroll behavioural-report widget opened.",
  },
  "lead.whatsapp_submitted": {
    category: "lead", weight: 10, scoreDim: "identity",
    meta: "Lead", ga4: "generate_lead", tiktok: "SubmitForm", serverSide: true,
    description: "Name + WhatsApp captured in exchange for the live behaviour report.",
  },

  // ---- ONBOARDING (stage 2 asset access) ---------------------------------
  "onboarding.started": {
    category: "onboarding", weight: 4, scoreDim: "fit", ga4: "onboarding_start",
    description: "Entered the asset-connection flow.",
  },
  "onboarding.website_submitted": {
    category: "onboarding", weight: 5, scoreDim: "fit", ga4: "onboarding_website",
    description: "Provided their live website. Enables technical audit.",
  },
  "onboarding.meta_requested": {
    category: "onboarding", weight: 6, scoreDim: "fit", ga4: "onboarding_meta",
    description: "Requested Meta Business asset access.",
  },
  "onboarding.gbp_requested": {
    category: "onboarding", weight: 5, scoreDim: "fit", ga4: "onboarding_gbp",
    description: "Requested Google Business Profile access.",
  },
  "onboarding.completed": {
    category: "onboarding", weight: 10, scoreDim: "fit",
    meta: "Subscribe", ga4: "onboarding_complete", serverSide: true,
    description: "All requested assets submitted. Client is activated.",
  },

  // ---- FRICTION / NEGATIVE SIGNALS ---------------------------------------
  "friction.rage_click": {
    category: "friction", weight: 0, scoreDim: "none", ga4: "rage_click",
    description: "3+ clicks in <1s on the same element. UX defect signal.",
  },
  "friction.dead_click": {
    category: "friction", weight: 0, scoreDim: "none", ga4: "dead_click",
    description: "Click on a non-interactive element that looks interactive.",
  },
  "friction.exit_intent": {
    category: "friction", weight: 2, scoreDim: "intent", ga4: "exit_intent",
    description: "Cursor left toward the browser chrome. Last-chance trigger.",
  },
  "friction.idle": {
    category: "friction", weight: 0, scoreDim: "none", ga4: "idle",
    description: "No input for 30s. Pauses activeMs accumulation.",
  },

  // ---- QUALIFICATION (server-derived) ------------------------------------
  "qualification.mql": {
    category: "qualification", weight: 0, scoreDim: "none",
    meta: "QualifiedLead", ga4: "qualified_lead", serverSide: true,
    description: "Score crossed the MQL threshold. Emitted server-side only.",
  },
  "qualification.sql": {
    category: "qualification", weight: 0, scoreDim: "none",
    meta: "QualifiedLead", ga4: "sales_qualified_lead", serverSide: true,
    description: "Score crossed the SQL threshold. Triggers human outreach.",
  },
} as const satisfies Record<string, EventSpec>;

export type EventName = keyof typeof EVENTS;

export const getSpec = (name: string): EventSpec | undefined =>
  (EVENTS as Record<string, EventSpec>)[name];

/** Every event that must be mirrored server-side to the Conversions API. */
export const SERVER_SIDE_EVENTS: string[] = Object.entries(EVENTS)
  .filter(([, s]) => (s as EventSpec).serverSide)
  .map(([k]) => k);

/**
 * Sections carry a dwell threshold and an intent multiplier. A visitor parked
 * on `pricing` is worth far more than one parked on `about`.
 */
export const SECTION_WEIGHTS: Record<string, { dwellMs: number; multiplier: number }> = {
  hero:        { dwellMs: 4000,  multiplier: 0.5 },
  problem:     { dwellMs: 6000,  multiplier: 1.0 },
  engine:      { dwellMs: 7000,  multiplier: 1.4 },
  services:    { dwellMs: 8000,  multiplier: 1.6 },
  method:      { dwellMs: 8000,  multiplier: 1.5 },
  packages:    { dwellMs: 6000,  multiplier: 2.5 },
  proof:       { dwellMs: 5000,  multiplier: 1.3 },
  team:        { dwellMs: 5000,  multiplier: 1.1 },
  faq:         { dwellMs: 6000,  multiplier: 1.7 },
  contact:     { dwellMs: 4000,  multiplier: 2.2 },
};

export const getSectionWeight = (id: string) =>
  SECTION_WEIGHTS[id] ?? { dwellMs: 6000, multiplier: 1.0 };
