/**
 * PIXEL FAN-OUT
 * ---------------------------------------------------------------------------
 * One internal event -> every ad platform that should hear about it, using
 * each platform's own naming from the taxonomy. Consent-gated: nothing fires
 * on the ads channels until `consent.ads` is true.
 *
 * Deduplication: the SAME eventId is sent to the browser Pixel and to the
 * server-side Conversions API. Meta then counts the conversion once and keeps
 * the higher-quality signal. This is the single most-missed step in most
 * implementations and it is why their CPA reporting drifts.
 */

import { getSpec } from "./taxonomy";
import type { ConsentState, TrackEvent } from "./types";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    ttq?: { track: (n: string, p?: unknown, o?: unknown) => void; page: () => void };
    lintrk?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    _aisDL?: unknown[];
  }
}

export interface PixelIds {
  metaPixelId?: string;
  ga4Id?: string;
  gtmId?: string;
  tiktokId?: string;
  linkedinId?: string;
  googleAdsId?: string;
}

/** Push onto the documented data layer. Always fires — GTM consumes it and
 *  applies its own consent rules; useful for debugging even when denied. */
export function pushDataLayer(event: TrackEvent, extra: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window._aisDL = window._aisDL || [];
  const payload = {
    event: event.name,
    ais_event_id: event.eventId,
    ais_category: event.category,
    ais_weight: event.weight,
    ais_section: event.sectionId,
    ais_block: event.blockId,
    ais_path: event.path,
    ...event.metadata,
    ...extra,
  };
  window.dataLayer.push(payload);
  window._aisDL.push(payload); // local mirror for the live behaviour widget
}

/**
 * Returns which channels actually accepted the event. The server stores this,
 * so `pixelFired && sentToMeta` gives a REAL Pixel<->CAPI match rate instead of
 * the assumption that the browser call succeeded. Blockers make that
 * assumption wrong 20-40% of the time, which is exactly the number we are
 * trying to measure.
 */
export interface FanOutResult { pixel: boolean; ga4: boolean; tiktok: boolean }

export function fanOut(event: TrackEvent, consent: ConsentState): FanOutResult {
  const result: FanOutResult = { pixel: false, ga4: false, tiktok: false };
  if (typeof window === "undefined") return result;
  pushDataLayer(event);

  const spec = getSpec(event.name);
  if (!spec) return result;

  // ---- Meta ---------------------------------------------------------------
  if (spec.meta && consent.ads && typeof window.fbq === "function") {
    const isStandard = STANDARD_META_EVENTS.has(spec.meta);
    try {
      window.fbq(
        isStandard ? "track" : "trackCustom",
        spec.meta,
        metaParams(event),
        { eventID: event.eventId } // <- dedup key shared with the CAPI call
      );
      result.pixel = true;
    } catch { /* blocked or stubbed by an extension */ }
  }

  // ---- GA4 / Google Ads ---------------------------------------------------
  if (spec.ga4 && consent.analytics && typeof window.gtag === "function") {
    try {
      window.gtag("event", spec.ga4, {
        event_id: event.eventId,
        ais_section: event.sectionId,
        ais_block: event.blockId,
        ais_weight: event.weight,
        ...event.metadata,
      });
      result.ga4 = true;
    } catch { /* blocked */ }
  }

  // ---- TikTok -------------------------------------------------------------
  if (spec.tiktok && consent.ads && window.ttq) {
    try {
      window.ttq.track(spec.tiktok, metaParams(event), { event_id: event.eventId });
      result.tiktok = true;
    } catch { /* blocked */ }
  }

  // ---- LinkedIn (conversion ids are numeric, mapped in env) ---------------
  if (consent.ads && typeof window.lintrk === "function") {
    const liId = LINKEDIN_CONVERSIONS[event.name];
    if (liId) window.lintrk("track", { conversion_id: liId });
  }

  return result;
}

const STANDARD_META_EVENTS = new Set([
  "PageView", "ViewContent", "Search", "AddToCart", "AddToWishlist",
  "InitiateCheckout", "AddPaymentInfo", "Purchase", "Lead", "CompleteRegistration",
  "Contact", "CustomizeProduct", "Donate", "FindLocation", "Schedule",
  "StartTrial", "SubmitApplication", "Subscribe",
]);

/** Numeric LinkedIn conversion ids — fill from the campaign manager. */
const LINKEDIN_CONVERSIONS: Record<string, number> = {};

function metaParams(e: TrackEvent) {
  return {
    content_name: e.sectionId ?? e.path,
    content_category: e.category,
    content_ids: e.blockId ? [e.blockId] : undefined,
    value: e.weight,
    currency: "EUR",
  };
}

/**
 * Inject the pixel snippets. Called once, after the consent decision, so we
 * never load ad-tech before we are allowed to.
 */
export function bootPixels(ids: PixelIds, consent: ConsentState) {
  if (typeof window === "undefined") return;

  if (ids.metaPixelId && consent.ads && !window.fbq) {
    /* eslint-disable */
    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq!("init", ids.metaPixelId);
  }

  if (ids.tiktokId && consent.ads && !window.ttq) {
    /* eslint-disable */
    (function (w: any, d: any, t: string) {
      w.TiktokAnalyticsObject = t; const ttq = (w[t] = w[t] || []);
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
      ttq.setAndDefer = function (o: any, m: string) { o[m] = function () { o.push([m].concat(Array.prototype.slice.call(arguments, 0))); }; };
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.load = function (e: string) {
        const u = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = u; ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
        ttq._o = ttq._o || {}; ttq._o[e] = {};
        const s = d.createElement("script"); s.type = "text/javascript"; s.async = true; s.src = `${u}?sdkid=${e}&lib=${t}`;
        const f = d.getElementsByTagName("script")[0]; f.parentNode.insertBefore(s, f);
      };
      ttq.load(ids.tiktokId);
      ttq.page();
    })(window, document, "ttq");
    /* eslint-enable */
  }
}
