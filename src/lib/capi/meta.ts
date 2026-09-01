/**
 * META CONVERSIONS API (server-side)
 * ---------------------------------------------------------------------------
 * Why this exists: iOS ATT, ITP cookie caps and ad blockers silently delete
 * 20-40% of browser Pixel events. Every one of those is a conversion Meta's
 * optimiser never learns from — the bid model degrades and CPA drifts upward.
 *
 * The contract:
 *   1. Browser Pixel fires with `eventID`.
 *   2. Server fires the SAME event with the SAME `event_id`.
 *   3. Meta deduplicates on (event_name, event_id) and keeps the richer copy.
 *
 * Sending both without a shared id double-counts. Sending only one loses
 * signal. This module always sends the pair.
 *
 * Match quality: every PII field is SHA-256 hashed, lowercased and trimmed to
 * Meta's normalisation spec before it leaves the process. Raw PII is never
 * transmitted and never logged.
 */

import { createHash } from "crypto";
import { getSpec } from "@/lib/tracking/taxonomy";

const GRAPH_VERSION = "v21.0";

export interface CapiUserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  country?: string;
  externalId?: string;
  fbp?: string;
  fbc?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
}

export interface CapiEvent {
  eventName: string;      // internal taxonomy name
  eventId: string;        // shared dedup key
  eventTime: number;      // epoch seconds
  eventSourceUrl?: string;
  actionSource?: "website" | "chat" | "phone_call" | "system_generated";
  user: CapiUserData;
  custom?: Record<string, unknown>;
  optOut?: boolean;
}

/** Meta normalisation: trim, lowercase, strip, then SHA-256 hex. */
const hash = (v?: string | null): string | undefined => {
  if (!v) return undefined;
  const norm = v.trim().toLowerCase();
  if (!norm) return undefined;
  return createHash("sha256").update(norm).digest("hex");
};

/** Phones must be digits only, with country code, no '+' or separators. */
const hashPhone = (v?: string | null): string | undefined => {
  if (!v) return undefined;
  const digits = v.replace(/[^0-9]/g, "");
  if (digits.length < 7) return undefined;
  return createHash("sha256").update(digits).digest("hex");
};

function buildUserData(u: CapiUserData) {
  const ud: Record<string, unknown> = {};
  const em = hash(u.email);           if (em) ud.em = [em];
  const ph = hashPhone(u.phone);      if (ph) ud.ph = [ph];
  const fn = hash(u.firstName);       if (fn) ud.fn = [fn];
  const ln = hash(u.lastName);        if (ln) ud.ln = [ln];
  const ct = hash(u.city);            if (ct) ud.ct = [ct];
  const co = hash(u.country);         if (co) ud.country = [co];
  // external_id is our own anonId — hashed, it is the strongest cross-device key.
  const ex = hash(u.externalId);      if (ex) ud.external_id = [ex];
  if (u.fbp) ud.fbp = u.fbp;
  if (u.fbc) ud.fbc = u.fbc;
  if (u.clientIpAddress) ud.client_ip_address = u.clientIpAddress;
  if (u.clientUserAgent) ud.client_user_agent = u.clientUserAgent;
  return ud;
}

export interface CapiResult {
  ok: boolean;
  sent: number;
  skipped: number;
  error?: string;
  traceId?: string;
}

export async function sendToMeta(events: CapiEvent[]): Promise<CapiResult> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;

  if (!pixelId || !token) {
    return { ok: false, sent: 0, skipped: events.length, error: "META_PIXEL_ID / META_CAPI_TOKEN not configured" };
  }

  const data = events
    .map((e) => {
      const spec = getSpec(e.eventName);
      const metaName = spec?.meta;
      if (!metaName) return null;
      return {
        event_name: metaName,
        event_id: e.eventId,                 // <- dedup key, identical to Pixel
        event_time: e.eventTime,
        event_source_url: e.eventSourceUrl,
        action_source: e.actionSource ?? "website",
        opt_out: e.optOut ?? false,
        user_data: buildUserData(e.user),
        custom_data: {
          currency: "EUR",
          ...e.custom,
        },
      };
    })
    .filter(Boolean);

  if (!data.length) return { ok: true, sent: 0, skipped: events.length };

  const body: Record<string, unknown> = { data };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const json = (await res.json()) as { events_received?: number; fbtrace_id?: string; error?: { message: string } };
    if (!res.ok) {
      return { ok: false, sent: 0, skipped: data.length, error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, sent: json.events_received ?? data.length, skipped: events.length - data.length, traceId: json.fbtrace_id };
  } catch (err) {
    return { ok: false, sent: 0, skipped: data.length, error: (err as Error).message };
  }
}

/**
 * GA4 Measurement Protocol — the Google-side equivalent of CAPI. Same idea:
 * server-confirmed conversions survive ad blockers.
 */
export async function sendToGa4(params: {
  clientId: string;
  events: { name: string; params: Record<string, unknown> }[];
  userId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const id = process.env.GA4_MEASUREMENT_ID;
  const secret = process.env.GA4_API_SECRET;
  if (!id || !secret) return { ok: false, error: "GA4 not configured" };

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${id}&api_secret=${secret}`,
      {
        method: "POST",
        body: JSON.stringify({
          client_id: params.clientId,
          user_id: params.userId,
          events: params.events,
        }),
      }
    );
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** TikTok Events API. */
export async function sendToTiktok(events: CapiEvent[]): Promise<{ ok: boolean; error?: string }> {
  const pixelCode = process.env.TIKTOK_PIXEL_ID;
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!pixelCode || !token) return { ok: false, error: "TikTok not configured" };

  const data = events
    .map((e) => {
      const name = getSpec(e.eventName)?.tiktok;
      if (!name) return null;
      return {
        event: name,
        event_id: e.eventId,
        event_time: e.eventTime,
        user: {
          email: hash(e.user.email),
          phone: hashPhone(e.user.phone),
          external_id: hash(e.user.externalId),
          ip: e.user.clientIpAddress,
          user_agent: e.user.clientUserAgent,
        },
        page: { url: e.eventSourceUrl },
        properties: e.custom,
      };
    })
    .filter(Boolean);

  if (!data.length) return { ok: true };

  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": token },
      body: JSON.stringify({ event_source: "web", event_source_id: pixelCode, data }),
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
