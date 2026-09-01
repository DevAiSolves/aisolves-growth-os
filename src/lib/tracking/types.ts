import type { EventCategory } from "./taxonomy";

/** The wire format for a single behavioural event. */
export interface TrackEvent {
  /** UUID v4. Reused as Meta `event_id` so Pixel and CAPI deduplicate. */
  eventId: string;
  name: string;
  category: EventCategory;
  weight: number;
  occurredAt: number; // epoch ms, client clock
  path: string;
  sectionId?: string;
  blockId?: string;
  elementId?: string;
  metadata: Record<string, unknown>;
}

/** Coarse device/environment signals. Deliberately non-unique — no canvas or
 *  audio fingerprinting, nothing that survives a cookie clear. */
export interface DeviceContext {
  deviceType: "mobile" | "tablet" | "desktop";
  os: string;
  browser: string;
  screenClass: string;
  viewport: string;
  language: string;
  timezone: string;
  connection: string;
  prefersDark: boolean;
  reducedMotion: boolean;
  touch: boolean;
  cpuCores: number;
  memoryGb: number | null;
}

export interface AttributionContext {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPage?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  msclkid?: string;
}

export interface ConsentState {
  granted: boolean;
  analytics: boolean;
  ads: boolean;
  personalization: boolean;
  method: "google_login" | "explicit_accept" | "declined" | null;
  at: number | null;
}

export interface TrackPayload {
  anonId: string;
  sessionId: string;
  events: TrackEvent[];
  device?: DeviceContext;
  attribution?: AttributionContext;
  consent: ConsentState;
  /** Meta browser cookies, needed for CAPI match quality. */
  fbp?: string;
  fbc?: string;
}

export interface BehaviorProfile {
  anonId: string;
  score: number;
  temperature: Temperature;
  breakdown: { intent: number; engage: number; fit: number; identity: number };
  signals: string[];
  totalActiveMs: number;
  maxScrollDepth: number;
  sessionCount: number;
  topSections: { sectionId: string; dwellMs: number }[];
}

export type Temperature = "COLD" | "WARM" | "HOT" | "MQL" | "SQL";
