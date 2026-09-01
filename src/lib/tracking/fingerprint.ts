import type { AttributionContext, DeviceContext } from "./types";

const ANON_KEY = "ais_aid";
const SESSION_KEY = "ais_sid";
const SESSION_TS = "ais_sts";
const FIRST_TOUCH = "ais_ft";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export const uuid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

/** First-party anonymous id. Cookie + localStorage so it survives either alone. */
export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  let id = readCookie(ANON_KEY) || safeLocal(ANON_KEY);
  if (!id) id = uuid();
  writeCookie(ANON_KEY, id, 400); // 400d = browser max for first-party cookies
  safeLocal(ANON_KEY, id);
  return id;
}

/** Rolling session id, expires after 30 min of inactivity. */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const now = Date.now();
  const last = Number(safeLocal(SESSION_TS) || 0);
  let sid = safeLocal(SESSION_KEY);
  if (!sid || now - last > SESSION_TIMEOUT_MS) sid = uuid();
  safeLocal(SESSION_KEY, sid);
  safeLocal(SESSION_TS, String(now));
  return sid;
}

export function touchSession() { safeLocal(SESSION_TS, String(Date.now())); }

export function isReturningVisitor(): boolean {
  return Boolean(safeLocal(FIRST_TOUCH)) && sessionCount() > 1;
}

export function sessionCount(): number {
  const n = Number(safeLocal("ais_scount") || 0);
  return n;
}

export function bumpSessionCount(): number {
  const n = sessionCount() + 1;
  safeLocal("ais_scount", String(n));
  return n;
}

// ---------------------------------------------------------------------------
// Device context — coarse buckets only. No canvas/audio/WebGL fingerprinting:
// it is legally hostile in the EU and adds nothing to lead quality.
// ---------------------------------------------------------------------------
export function getDeviceContext(): DeviceContext {
  const ua = navigator.userAgent;
  const w = window.innerWidth;
  const deviceType = w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";

  const os =
    /Windows/i.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/i.test(ua) ? "macOS" :
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iPod/i.test(ua) ? "iOS" :
    /Linux/i.test(ua) ? "Linux" : "Other";

  const browser =
    /Edg\//i.test(ua) ? "Edge" :
    /OPR\//i.test(ua) ? "Opera" :
    /Chrome\//i.test(ua) ? "Chrome" :
    /Safari\//i.test(ua) && !/Chrome/i.test(ua) ? "Safari" :
    /Firefox\//i.test(ua) ? "Firefox" : "Other";

  const sw = window.screen?.width ?? w;
  const screenClass = sw < 480 ? "xs" : sw < 768 ? "sm" : sw < 1280 ? "md" : sw < 1920 ? "lg" : "xl";

  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string };
    deviceMemory?: number;
  };

  return {
    deviceType,
    os,
    browser,
    screenClass,
    viewport: `${w}x${window.innerHeight}`,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    connection: nav.connection?.effectiveType ?? "unknown",
    prefersDark: matchMedia("(prefers-color-scheme: dark)").matches,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    touch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    cpuCores: navigator.hardwareConcurrency || 0,
    memoryGb: nav.deviceMemory ?? null,
  };
}

// ---------------------------------------------------------------------------
// Attribution — first touch is written once and never overwritten.
// ---------------------------------------------------------------------------
export function getAttribution(): AttributionContext {
  const p = new URLSearchParams(window.location.search);
  const current: AttributionContext = {
    utmSource: p.get("utm_source") ?? undefined,
    utmMedium: p.get("utm_medium") ?? undefined,
    utmCampaign: p.get("utm_campaign") ?? undefined,
    utmContent: p.get("utm_content") ?? undefined,
    utmTerm: p.get("utm_term") ?? undefined,
    fbclid: p.get("fbclid") ?? undefined,
    gclid: p.get("gclid") ?? undefined,
    ttclid: p.get("ttclid") ?? undefined,
    msclkid: p.get("msclkid") ?? undefined,
    referrer: document.referrer || undefined,
    landingPage: window.location.pathname,
  };

  if (!safeLocal(FIRST_TOUCH)) {
    safeLocal(FIRST_TOUCH, JSON.stringify(current));
  }
  // Meta's _fbc must be persisted from fbclid the moment we see it.
  if (current.fbclid && !readCookie("_fbc")) {
    writeCookie("_fbc", `fb.1.${Date.now()}.${current.fbclid}`, 90);
  }
  return current;
}

export function getFirstTouch(): AttributionContext {
  try { return JSON.parse(safeLocal(FIRST_TOUCH) || "{}"); } catch { return {}; }
}

/** Meta browser id. If Pixel has not set it yet, we mint a compliant one. */
export function getFbp(): string | undefined {
  let fbp = readCookie("_fbp");
  if (!fbp) {
    fbp = `fb.1.${Date.now()}.${Math.floor(Math.random() * 1e10)}`;
    writeCookie("_fbp", fbp, 90);
  }
  return fbp;
}

export const getFbc = () => readCookie("_fbc") || undefined;

// ---------------------------------------------------------------------------
// storage helpers
// ---------------------------------------------------------------------------
export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[2]) : undefined;
}

export function writeCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${exp};path=/;SameSite=Lax`;
}

function safeLocal(key: string, value?: string): string | undefined {
  try {
    if (value !== undefined) { localStorage.setItem(key, value); return value; }
    return localStorage.getItem(key) ?? undefined;
  } catch { return undefined; }
}
