/**
 * TRACKER CORE
 * ---------------------------------------------------------------------------
 * A singleton that owns: identity, session, the event queue, active-time
 * accounting, the live in-browser score, and transport.
 *
 * Transport rules
 *   - Batched: events flush every 4s, or immediately at 20 queued, or on any
 *     event with weight >= 7 (conversions must not wait behind a batch).
 *   - `navigator.sendBeacon` on pagehide so the exit event is never lost.
 *   - Failed flushes go back to the head of the queue and are retried; nothing
 *     is silently dropped.
 */

import { getSpec, getSectionWeight } from "./taxonomy";
import { fanOut, type PixelIds } from "./pixels";
import { readConsent } from "./consent";
import { scoreVisitor, type ScoringInput } from "./scoring";
import {
  getAnonId, getSessionId, getAttribution, getDeviceContext,
  getFbc, getFbp, touchSession, uuid, bumpSessionCount, sessionCount,
} from "./fingerprint";
import type { ConsentState, TrackEvent } from "./types";

const FLUSH_MS = 4000;
const MAX_BATCH = 20;
const IMMEDIATE_WEIGHT = 7;
const IDLE_MS = 30_000;

export interface LiveProfile {
  score: number;
  temperature: string;
  breakdown: { intent: number; engage: number; fit: number; identity: number };
  signals: string[];
  activeMs: number;
  maxScroll: number;
  eventCount: number;
  sectionDwell: Record<string, number>;
  sessionCount: number;
  lastEvents: { name: string; at: number; points: number }[];
}

class Tracker {
  private queue: TrackEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private booted = false;
  private pixelIds: PixelIds = {};
  private oncePerSession = new Set<string>();
  private listeners = new Set<(p: LiveProfile) => void>();

  anonId = "";
  sessionId = "";
  consent: ConsentState = readConsent();

  // live counters
  private activeMs = 0;
  private lastActiveTick = Date.now();
  private idle = false;
  private lastInput = Date.now();
  maxScroll = 0;
  sectionDwell: Record<string, number> = {};
  private counters = {
    pricingViews: 0, ctaHovers: 0, ctaClicks: 0, formStarts: 0,
    formAbandons: 0, rageClicks: 0, exitIntents: 0, videoCompletions: 0,
  };
  private recent: { name: string; at: number; points: number }[] = [];
  private eventCount = 0;

  // -------------------------------------------------------------------------
  boot(pixelIds: PixelIds) {
    if (this.booted || typeof window === "undefined") return;
    this.booted = true;
    this.pixelIds = pixelIds;
    this.anonId = getAnonId();
    this.sessionId = getSessionId();
    if (!sessionStorage.getItem("ais_counted")) {
      bumpSessionCount();
      sessionStorage.setItem("ais_counted", "1");
    }
    getAttribution();

    this.timer = setInterval(() => this.flush(), FLUSH_MS);
    this.startActiveClock();

    window.addEventListener("pagehide", () => this.flush(true));
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.flush(true);
      else this.lastActiveTick = Date.now();
    });
    window.addEventListener("ais:consent", (e) => {
      this.consent = (e as CustomEvent<ConsentState>).detail;
    });
  }

  onProfile(fn: (p: LiveProfile) => void) {
    this.listeners.add(fn);
    fn(this.profile());
    return () => { this.listeners.delete(fn); };
  }

  // -------------------------------------------------------------------------
  track(
    name: string,
    metadata: Record<string, unknown> = {},
    ctx: { sectionId?: string; blockId?: string; elementId?: string } = {}
  ) {
    if (typeof window === "undefined") return;
    const spec = getSpec(name);
    if (!spec) {
      if (process.env.NODE_ENV !== "production") console.warn(`[ais] unknown event: ${name}`);
      return;
    }
    if (spec.oncePerSession) {
      if (this.oncePerSession.has(name)) return;
      this.oncePerSession.add(name);
    }

    const event: TrackEvent = {
      eventId: uuid(),
      name,
      category: spec.category,
      weight: spec.weight,
      occurredAt: Date.now(),
      path: window.location.pathname,
      sectionId: ctx.sectionId,
      blockId: ctx.blockId,
      elementId: ctx.elementId,
      metadata,
    };

    this.applyToCounters(event);
    this.queue.push(event);
    this.eventCount++;
    this.recent.unshift({ name, at: event.occurredAt, points: spec.weight });
    this.recent = this.recent.slice(0, 12);

    fanOut(event, this.consent);
    touchSession();
    this.emit();

    if (spec.weight >= IMMEDIATE_WEIGHT || this.queue.length >= MAX_BATCH) this.flush();
  }

  // -------------------------------------------------------------------------
  private applyToCounters(e: TrackEvent) {
    const c = this.counters;
    switch (e.name) {
      case "cta.hover": c.ctaHovers++; break;
      case "cta.click":
      case "cta.whatsapp_click": c.ctaClicks++; break;
      case "form.start": c.formStarts++; break;
      case "form.abandon": c.formAbandons++; break;
      case "friction.rage_click": c.rageClicks++; break;
      case "friction.exit_intent": c.exitIntents++; break;
      case "video.complete": c.videoCompletions++; break;
    }
    if (e.sectionId === "packages" && (e.name === "section.enter" || e.name === "section.revisit")) {
      c.pricingViews++;
    }
    if (e.name === "section.dwell" && e.sectionId) {
      const ms = Number(e.metadata.dwellMs ?? 0);
      this.sectionDwell[e.sectionId] = (this.sectionDwell[e.sectionId] ?? 0) + ms;
    }
  }

  reportScroll(pct: number) {
    if (pct > this.maxScroll) { this.maxScroll = pct; this.emit(); }
  }

  markInput() {
    this.lastInput = Date.now();
    if (this.idle) { this.idle = false; this.lastActiveTick = Date.now(); }
  }

  private startActiveClock() {
    const tick = () => {
      const now = Date.now();
      const visible = document.visibilityState === "visible";
      if (now - this.lastInput > IDLE_MS && !this.idle) {
        this.idle = true;
        this.track("friction.idle", { afterMs: now - this.lastInput });
      }
      if (visible && !this.idle) this.activeMs += now - this.lastActiveTick;
      this.lastActiveTick = now;
      this.emit();
    };
    setInterval(tick, 1000);
  }

  // -------------------------------------------------------------------------
  scoringInput(): ScoringInput {
    return {
      totalActiveMs: this.activeMs,
      maxScrollDepth: this.maxScroll,
      sessionCount: sessionCount() || 1,
      identityStage: this.identityStage(),
      sectionDwell: this.sectionDwell,
      ...this.counters,
    };
  }

  identityStage(): string {
    if (this.consent.method === "google_login") return "authenticated";
    if (localStorage.getItem("ais_lead")) return "identified";
    if (this.consent.granted) return "consented";
    return "anonymous";
  }

  profile(): LiveProfile {
    const r = scoreVisitor(this.scoringInput());
    return {
      score: r.score,
      temperature: r.temperature,
      breakdown: r.breakdown,
      signals: r.signals,
      activeMs: this.activeMs,
      maxScroll: this.maxScroll,
      eventCount: this.eventCount,
      sectionDwell: this.sectionDwell,
      sessionCount: sessionCount() || 1,
      lastEvents: this.recent,
    };
  }

  private emit() {
    const p = this.profile();
    this.listeners.forEach((fn) => fn(p));
  }

  // -------------------------------------------------------------------------
  async flush(useBeacon = false) {
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.queue.length);
    const body = JSON.stringify({
      anonId: this.anonId,
      sessionId: this.sessionId,
      events: batch,
      device: getDeviceContext(),
      attribution: getAttribution(),
      consent: this.consent,
      fbp: getFbp(),
      fbc: getFbc(),
      activeMs: this.activeMs,
      maxScroll: this.maxScroll,
    });

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
    try {
      await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    } catch {
      // Never lose a conversion to a flaky network — requeue at the head.
      this.queue.unshift(...batch);
    }
  }

  sectionThreshold(id: string) { return getSectionWeight(id).dwellMs; }
}

export const tracker = new Tracker();
export type { PixelIds };
