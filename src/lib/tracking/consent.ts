import type { ConsentState } from "./types";

const KEY = "ais_consent";

export const DEFAULT_CONSENT: ConsentState = {
  granted: false, analytics: false, ads: false,
  personalization: false, method: null, at: null,
};

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return DEFAULT_CONSENT;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_CONSENT, ...JSON.parse(raw) } : DEFAULT_CONSENT;
  } catch { return DEFAULT_CONSENT; }
}

export function writeConsent(next: Partial<ConsentState>): ConsentState {
  const merged: ConsentState = { ...readConsent(), ...next, at: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* private mode */ }
  syncGoogleConsentMode(merged);
  window.dispatchEvent(new CustomEvent("ais:consent", { detail: merged }));
  return merged;
}

/**
 * Google Consent Mode v2. Must run BEFORE gtag config to be honoured, and
 * again on every change. Denied by default is the compliant posture.
 */
export function syncGoogleConsentMode(c: ConsentState) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  function gtag(...args: unknown[]) { w.dataLayer!.push(args); }
  gtag("consent", "update", {
    ad_storage: c.ads ? "granted" : "denied",
    ad_user_data: c.ads ? "granted" : "denied",
    ad_personalization: c.personalization ? "granted" : "denied",
    analytics_storage: c.analytics ? "granted" : "denied",
    functionality_storage: "granted",
    security_storage: "granted",
  });
}

/** Before consent we still measure — but only aggregate, never personal. */
export function collectionLevel(c: ConsentState): "aggregate" | "full" {
  return c.granted && c.analytics ? "full" : "aggregate";
}
