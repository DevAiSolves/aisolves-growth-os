import type { TrafficType } from "@/lib/tracking/fingerprint";

/**
 * Server-side traffic classification.
 *
 * Mirrors the client classifier but works on the attribution object alone (no
 * `window`), so the server never has to trust a value the browser computed.
 */
const PAID_MEDIUMS = ["cpc", "ppc", "paid", "paidsocial", "paid_social", "display", "cpm", "banner", "retargeting"];
const SOCIAL_HOSTS = ["facebook.", "instagram.", "t.co", "twitter.", "x.com", "linkedin.", "tiktok.", "pinterest.", "reddit."];
const SEARCH_HOSTS = ["google.", "bing.", "duckduckgo.", "yahoo.", "ecosia.", "brave."];

export function classifyTrafficServer(a: Record<string, unknown>): TrafficType {
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");

  if (str("fbclid") || str("gclid") || str("ttclid") || str("msclkid")) return "paid";

  const medium = str("utmMedium").toLowerCase();
  if (PAID_MEDIUMS.some((m) => medium.includes(m))) return "paid";
  if (medium.includes("email") || medium.includes("newsletter")) return "email";
  if (medium.includes("social")) return "social";
  if (medium === "organic") return "organic";

  const ref = str("referrer").toLowerCase();
  if (!ref) return str("utmSource") ? "referral" : "direct";
  try {
    const host = new URL(ref).hostname;
    if (SEARCH_HOSTS.some((h) => host.includes(h))) return "organic";
    if (SOCIAL_HOSTS.some((h) => host.includes(h))) return "social";
    return "referral";
  } catch {
    return "referral";
  }
}
