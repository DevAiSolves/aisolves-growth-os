/**
 * EVENT MATCH QUALITY — PROXY
 * ---------------------------------------------------------------------------
 * IMPORTANT: Meta's real EMQ (0-10) is computed by Meta from match rates
 * against their own graph. It is NOT derivable from our side. Anything this
 * module returns is an ESTIMATE of the ceiling our payload could reach, based
 * purely on which match keys we actually send.
 *
 * Read it as: "given what we transmit, the best EMQ we could plausibly earn."
 * Real EMQ is always <= this, because a hashed email that does not exist in
 * Meta's graph still counts as sent here and matches nothing there.
 *
 * Always surface it labelled ESTIMADO, and always link to the real number in
 * Events Manager → Data Sources → your pixel → Overview.
 */

export interface MatchKeys {
  email?: boolean;
  phone?: boolean;
  firstName?: boolean;
  lastName?: boolean;
  externalId?: boolean;
  fbp?: boolean;
  fbc?: boolean;
  ip?: boolean;
  userAgent?: boolean;
  city?: boolean;
  country?: boolean;
}

/**
 * Weights reflect Meta's published guidance on which parameters move match
 * quality most. They sum to 10.0 when every key is present.
 */
const WEIGHTS: { key: keyof MatchKeys; w: number; label: string }[] = [
  { key: "email",      w: 2.6, label: "em (email)" },
  { key: "phone",      w: 2.0, label: "ph (teléfono)" },
  { key: "externalId", w: 1.5, label: "external_id" },
  { key: "fbc",        w: 1.0, label: "fbc (click id)" },
  { key: "fbp",        w: 0.8, label: "fbp (browser id)" },
  { key: "ip",         w: 0.6, label: "client_ip_address" },
  { key: "userAgent",  w: 0.5, label: "client_user_agent" },
  { key: "firstName",  w: 0.4, label: "fn" },
  { key: "lastName",   w: 0.3, label: "ln" },
  { key: "country",    w: 0.2, label: "country" },
  { key: "city",       w: 0.1, label: "ct" },
];

export interface EmqEstimate {
  /** 0-10, estimated ceiling. */
  score: number;
  /** Always "estimated" — never claim this is Meta's number. */
  source: "estimated";
  present: string[];
  missing: string[];
  /** The single highest-value key we are not sending. */
  biggestGap: string | null;
  /** Points recoverable by fixing the top 3 gaps. */
  recoverable: number;
}

export function estimateEmq(keys: MatchKeys): EmqEstimate {
  let score = 0;
  const present: string[] = [];
  const missing: { label: string; w: number }[] = [];

  for (const { key, w, label } of WEIGHTS) {
    if (keys[key]) { score += w; present.push(label); }
    else missing.push({ label, w });
  }

  missing.sort((a, b) => b.w - a.w);
  const top3 = missing.slice(0, 3);

  return {
    score: Math.round(score * 10) / 10,
    source: "estimated",
    present,
    missing: missing.map((m) => m.label),
    biggestGap: missing[0]?.label ?? null,
    recoverable: Math.round(top3.reduce((a, m) => a + m.w, 0) * 10) / 10,
  };
}

/** Normalised 0..1 for the composite traffic score. */
export const emqNorm = (score: number | null): number | null =>
  score === null ? null : Math.max(0, Math.min(1, score / 10));

/**
 * Pixel ↔ CAPI deduplication health.
 *
 * The failure modes this catches:
 *  - matched  : both sides fired with the same event_id. Correct.
 *  - capiOnly : the browser Pixel was blocked. This is CAPI doing its job —
 *               recovered signal, not an error.
 *  - pixelOnly: the server never sent it. A real gap: server-side events
 *               survive blockers, so every optimisation event should have one.
 *
 * `matchRate` = matched / (events where CAPI was attempted).
 * A mismatch above 30% is a critical break: either double counting (if
 * event_ids differ) or a CAPI outage.
 */
export interface DedupHealth {
  total: number;
  matched: number;
  pixelOnly: number;
  capiOnly: number;
  neither: number;
  matchRate: number | null;
  mismatchRate: number | null;
  verdict: string;
}

export function dedupHealth(rows: { pixelFired: boolean; sentToMeta: boolean }[]): DedupHealth {
  const total = rows.length;
  if (!total) {
    return { total: 0, matched: 0, pixelOnly: 0, capiOnly: 0, neither: 0,
             matchRate: null, mismatchRate: null, verdict: "Sin eventos server-side registrados" };
  }
  let matched = 0, pixelOnly = 0, capiOnly = 0, neither = 0;
  for (const r of rows) {
    if (r.pixelFired && r.sentToMeta) matched++;
    else if (r.pixelFired) pixelOnly++;
    else if (r.sentToMeta) capiOnly++;
    else neither++;
  }
  const matchRate = (matched / total) * 100;
  const mismatchRate = 100 - matchRate;

  let verdict: string;
  if (mismatchRate > 30) {
    verdict = capiOnly > pixelOnly
      ? `CAPI está recuperando ${capiOnly} eventos que el navegador perdió — bloqueadores, no rotura`
      : `${pixelOnly} eventos sin contraparte server-side — gap real de CAPI`;
  } else {
    verdict = "Deduplicación sana";
  }

  return {
    total, matched, pixelOnly, capiOnly, neither,
    matchRate: Math.round(matchRate * 10) / 10,
    mismatchRate: Math.round(mismatchRate * 10) / 10,
    verdict,
  };
}
