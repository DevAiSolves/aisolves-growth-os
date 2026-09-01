/**
 * LEAD SUBMISSION WITH A DURABLE RETRY QUEUE
 * ---------------------------------------------------------------------------
 * A lead is the single most expensive event on the site. Losing one to a
 * transient 5xx, a dropped connection or a tab closed mid-request is not an
 * edge case worth shrugging at — it is the whole point of the funnel.
 *
 * So: try, retry once, and if it still fails, persist the payload locally and
 * flush it on the next page load. The visitor still gets their report either
 * way (it is computed with the same scoring function client-side), but the
 * lead itself is never silently dropped.
 */

const QUEUE_KEY = "ais_lead_queue";

export interface LeadPayload {
  anonId: string;
  name: string;
  whatsapp: string;
  email?: string;
  company?: string;
  website?: string;
  source: string;
  queuedAt?: number;
}

export interface LeadResponse {
  ok: boolean;
  leadId?: string;
  report?: Record<string, unknown>;
  routing?: { action: string; sla: string; channel: string };
  error?: string;
  /** True when the lead could not reach the server and was queued locally. */
  queued?: boolean;
}

async function post(payload: LeadPayload): Promise<Response> {
  return fetch("/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  });
}

export async function submitLead(payload: LeadPayload): Promise<LeadResponse> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await post(payload);
      const json = (await res.json()) as LeadResponse;
      if (res.ok && json.ok) return json;

      // A 400 means the payload itself is wrong — retrying cannot fix it, and
      // queueing a permanently invalid lead would poison the queue forever.
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, error: json.error ?? `HTTP ${res.status}` };
      }
    } catch {
      /* network failure — fall through to the retry, then to the queue */
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
  }

  enqueue(payload);
  return { ok: false, queued: true, error: "network" };
}

function enqueue(payload: LeadPayload) {
  try {
    const q = readQueue();
    q.push({ ...payload, queuedAt: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-10)));
  } catch { /* private mode: nothing more we can do */ }
}

function readQueue(): LeadPayload[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"); }
  catch { return []; }
}

/** Called once on boot. Drains anything a previous visit could not deliver. */
export async function flushLeadQueue(): Promise<number> {
  const q = readQueue();
  if (!q.length) return 0;

  const remaining: LeadPayload[] = [];
  let sent = 0;
  for (const lead of q) {
    // Give up on anything older than 7 days rather than retrying forever.
    if (lead.queuedAt && Date.now() - lead.queuedAt > 7 * 864e5) continue;
    try {
      const res = await post(lead);
      if (res.ok) { sent++; continue; }
      if (res.status >= 500) remaining.push(lead);
    } catch {
      remaining.push(lead);
    }
  }
  try {
    if (remaining.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    else localStorage.removeItem(QUEUE_KEY);
  } catch { /* ignore */ }
  return sent;
}

/** E.164-ish normalisation. Meta's CAPI wants digits with a country code. */
export function normalisePhone(raw: string, defaultCc = "34"): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const bare = digits.replace(/\D/g, "");
  if (bare.length <= 9) return `+${defaultCc}${bare}`;
  return `+${bare}`;
}
