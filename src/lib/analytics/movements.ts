/**
 * TRAFFIC LAB — THE 20-MOVEMENT TABLE
 * ---------------------------------------------------------------------------
 * Strict UU discipline. Three different denominators live in this file and
 * they are never interchangeable:
 *
 *   UU       distinct visitors            <- the denominator for funnel %
 *   Events   raw event fires              <- can exceed UU, and often should
 *   Events/UU  ratio                      <- >1 means repetition, not reach
 *
 * A row's `pct` is ALWAYS over UU entrada. If a metric cannot be computed for
 * lack of instrumentation, it returns null and renders ⚫ — never 0.
 */

import type { PrismaClient } from "@prisma/client";
import { SERVER_SIDE_EVENTS } from "@/lib/tracking/taxonomy";
import { BENCHMARKS, verdict, type Verdict } from "./benchmarks";
import { dedupHealth, estimateEmq, type DedupHealth, type EmqEstimate } from "./emq";
import { trafficScore, type ScoreResult } from "./trafficScore";

export interface Filter {
  from: Date;
  to: Date;
  trafficType?: string;
  deviceType?: string;
}

export interface Movement {
  key: string;
  label: string;
  /** Distinct users. null = not measurable. */
  uu: number | null;
  /** % over UU entrada. */
  pct: number | null;
  events: number | null;
  eventsPerUu: number | null;
  verdict: Verdict;
  /** 0..1 for the bar. Uses benchmark attainment when one exists, else pct/100. */
  ratio: number | null;
  /** Median ms to reach this state. */
  medianMs: number | null;
  note: string;
}

export interface LabReport {
  meta: {
    from: string; to: string; segment: string;
    uuEntrada: number; sessions: number; totalEvents: number;
    sessionsPerUu: number | null;
    generatedAt: string;
    source: string;
  };
  score: ScoreResult;
  movements: Movement[];
  timing: { label: string; uu: number; pct: number }[];
  sections: {
    id: string; label: string; uu: number; pct: number | null;
    medianDwellMs: number | null; light: Verdict["light"]; friction: string; fix: string;
  }[];
  timeline: { t: string; sees: string; does: string; event: string; firing: boolean }[];
  emq: EmqEstimate & { benchmark: Verdict };
  dedup: DedupHealth & { benchmark: Verdict };
  metaSignal: {
    optimize: { name: string; meta: string; fires: number; uu: number }[];
    reporting: { name: string; meta: string; fires: number }[];
    gaps: string[];
  };
  dataGaps: string[];
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const safePct = (n: number, d: number): number | null =>
  d === 0 ? null : Math.round((n / d) * 1000) / 10;

const SECTION_LABELS: { id: string; label: string; friction: string; fix: string }[] = [
  { id: "hero",     label: "Hero",   friction: "Promesa compite con el gráfico",       fix: "Subir el CTA por encima del pliegue en mobile" },
  { id: "problem",  label: "Proof",  friction: "Tres cifras sin fuente citada",        fix: "Añadir origen del dato bajo cada número" },
  { id: "engine",   label: "Oferta", friction: "Densidad técnica alta",                fix: "Un beneficio por columna antes del detalle" },
  { id: "services", label: "Demo",   friction: "16 ítems sin jerarquía",               fix: "Colapsar a 4 y expandir bajo demanda" },
  { id: "method",   label: "Método", friction: "Timeline larga en mobile",             fix: "Convertir en carrusel horizontal < 768px" },
  { id: "packages", label: "Precio", friction: "Precio sin anclaje comparativo",       fix: "Marcar el plan recomendado antes del scroll" },
  { id: "faq",      label: "FAQ",    friction: "Objeciones enterradas al final",       fix: "Subir las 3 con más aperturas junto al precio" },
  { id: "contact",  label: "Form",   friction: "Campo con más dudas medidas",          fix: "Eliminar el campo de mayor hesitation" },
];

export async function buildLabReport(prisma: PrismaClient, f: Filter): Promise<LabReport> {
  const where = {
    createdAt: { gte: f.from, lte: f.to },
    ...(f.trafficType ? { trafficType: f.trafficType } : {}),
    ...(f.deviceType ? { deviceType: f.deviceType } : {}),
  };

  const visitors = await prisma.visitor.findMany({
    where,
    select: {
      id: true, anonId: true, sessionCount: true, totalEvents: true, totalActiveMs: true,
      survivedMs: true, maxScrollDepth: true, qualityVisit: true, offerViewed: true,
      bounced: true, hasInteracted: true, ctaViews: true, ctaClicks: true,
      formStarts: true, formSubmits: true, rageClicks: true, jsErrors: true,
      scrollTimings: true, timeToFirstEvent: true, trafficType: true, deviceType: true,
      leadId: true, consentAds: true,
    },
  });

  const uuEntrada = visitors.length;
  const ids = visitors.map((v) => v.id);
  const dataGaps: string[] = [];

  // Nothing to report on. Return an all-⚫ skeleton rather than zeros.
  if (!uuEntrada) {
    return emptyReport(f, "Sin visitantes en el periodo y segmento seleccionados");
  }

  const [eventGroups, sessions, dedupRows, sectionDwellRows, leads] = await Promise.all([
    prisma.event.groupBy({
      by: ["name"],
      where: { visitorId: { in: ids }, occurredAt: { gte: f.from, lte: f.to } },
      _count: true,
    }),
    prisma.visitSession.count({ where: { visitorId: { in: ids } } }),
    // ONLY events where CAPI was actually attempted. Reporting-only events
    // have no server counterpart by design and must not dilute the match rate.
    prisma.event.findMany({
      where: { visitorId: { in: ids }, name: { in: SERVER_SIDE_EVENTS } },
      select: { pixelFired: true, sentToMeta: true },
      take: 5000,
    }),
    prisma.event.findMany({
      where: { visitorId: { in: ids }, name: "section.dwell" },
      select: { visitorId: true, sectionId: true, metadata: true },
      take: 8000,
    }),
    prisma.lead.count({ where: { visitorId: { in: ids } } }),
  ]);

  const eventCount = (name: string) =>
    eventGroups.find((g) => g.name === name)?._count ?? 0;
  const totalEvents = eventGroups.reduce((a, g) => a + g._count, 0);

  // ---- UU per behaviour (distinct visitors, NOT event fires) -------------
  const uuWith = async (name: string) => {
    const rows = await prisma.event.findMany({
      where: { visitorId: { in: ids }, name },
      select: { visitorId: true },
      distinct: ["visitorId"],
    });
    return rows.length;
  };

  const [uu3, uu8, uu15, uu30, uuS25, uuS50, uuS75, uuS90, uuCtaView, uuCtaClick,
         uuFormStart, uuFormSubmit, uuRage] = await Promise.all([
    uuWith("time.survived_3s"), uuWith("time.survived_8s"), uuWith("time.survived_15s"),
    uuWith("time.survived_30s"),
    uuWith("scroll.depth_25"), uuWith("scroll.depth_50"), uuWith("scroll.depth_75"),
    uuWith("scroll.depth_90"),
    uuWith("cta.view"), uuWith("cta.click"),
    uuWith("form.start"), uuWith("form.submit"), uuWith("friction.rage_click"),
  ]);

  const uuQuality = visitors.filter((v) => v.qualityVisit).length;
  const uuOffer   = visitors.filter((v) => v.offerViewed).length;
  const uuBounce  = visitors.filter((v) => v.bounced).length;

  // ---- median timings ----------------------------------------------------
  const scrollTimingAt = (m: number): number | null => {
    const vals: number[] = [];
    for (const v of visitors) {
      try {
        const t = JSON.parse(v.scrollTimings) as Record<string, number>;
        if (t[m] != null) vals.push(t[m]);
      } catch { /* ignore */ }
    }
    return median(vals);
  };

  // ---- EMQ (estimated ceiling from the keys we actually transmit) --------
  const anyLead = leads > 0;
  const emq = estimateEmq({
    email: anyLead, phone: anyLead, firstName: anyLead,
    externalId: true, fbp: true,
    fbc: visitors.some((v) => v.trafficType === "paid"),
    ip: true, userAgent: true,
    country: true, city: true, lastName: false,
  });
  if (!anyLead) dataGaps.push("EMQ estimado sin em/ph: aún no hay leads en el periodo");

  const dedup = dedupHealth(dedupRows);
  if (!dedupRows.length) dataGaps.push("Sin eventos server-side: CAPI no configurada o consentimiento de ads ausente");

  // ---- composite score ---------------------------------------------------
  const score = trafficScore({
    bounce: safePctRatio(uuBounce, uuEntrada),
    scroll50: safePctRatio(uuS50, uuEntrada),
    time15: safePctRatio(uu15, uuEntrada),
    ctaView: safePctRatio(uuCtaView, uuEntrada),
    emqNorm: emq.score / 10,
    convSignal: safePctRatio(uuQuality + leads, uuEntrada),
  });

  // ---- the 20 fixed rows -------------------------------------------------
  const row = (
    key: string, label: string, uu: number | null, events: number | null,
    v: Verdict, medianMs: number | null, note: string, ratioOverride?: number | null
  ): Movement => {
    const pct = uu === null ? null : safePct(uu, uuEntrada);
    return {
      key, label, uu, pct, events,
      eventsPerUu: uu && events !== null && uu > 0 ? Math.round((events / uu) * 100) / 100 : null,
      verdict: v,
      ratio: ratioOverride !== undefined ? ratioOverride
           : v.attainment !== null ? Math.min(1, v.attainment)
           : pct === null ? null : pct / 100,
      medianMs, note,
    };
  };

  const noBench: Verdict = { light: "green", attainment: 1, reason: "Denominador de referencia" };
  const unmeasured = (why: string): Verdict => ({ light: "black", attainment: null, reason: why });

  const pvEvents = eventCount("page.view");
  const pvRatio = uuEntrada ? pvEvents / uuEntrada : null;

  const movements: Movement[] = [
    row("uu", "UU entrada", uuEntrada, pvEvents, noBench, null, "Denominador de todo"),
    row("bounce", "Bounce", uuBounce, eventCount("quality.bounce"),
        verdict(safePct(uuBounce, uuEntrada), BENCHMARKS.bouncePaid), null,
        "Menos es mejor · barra invertida",
        safePct(uuBounce, uuEntrada) === null ? null : Math.min(1, safePct(uuBounce, uuEntrada)! / 55)),
    row("s3",  "Survived 3s",  uu3,  eventCount("time.survived_3s"),  pctVerdict(uu3, uuEntrada, 70),  medianOf(visitors, 3000),  "Bajo esto es rebote"),
    row("s8",  "Survived 8s",  uu8,  eventCount("time.survived_8s"),  pctVerdict(uu8, uuEntrada, 50),  null, "Oferta pudo registrarse"),
    row("s15", "Survived 15s", uu15, eventCount("time.survived_15s"), verdict(safePct(uu15, uuEntrada), BENCHMARKS.time15), null, "Mitad de Quality Visit"),
    row("s30", "Survived 30s", uu30, eventCount("time.survived_30s"), pctVerdict(uu30, uuEntrada, 20), null, "Lectura real, no skim"),
    row("sc25", "Scroll 25", uuS25, eventCount("scroll.depth_25"), pctVerdict(uuS25, uuEntrada, 70), scrollTimingAt(25), "Pasó el hero"),
    row("sc50", "Scroll 50", uuS50, eventCount("scroll.depth_50"), verdict(safePct(uuS50, uuEntrada), BENCHMARKS.scroll50), scrollTimingAt(50), "Mitad de página"),
    row("sc75", "Scroll 75", uuS75, eventCount("scroll.depth_75"), verdict(safePct(uuS75, uuEntrada), BENCHMARKS.scroll75), scrollTimingAt(75), "Correlaciona con lead"),
    row("sc90", "Scroll 90", uuS90, eventCount("scroll.depth_90"), pctVerdict(uuS90, uuEntrada, 20), scrollTimingAt(90), "Leyó hasta el final"),
    row("qv", "Quality Visit", uuQuality, eventCount("quality.visit"), verdict(safePct(uuQuality, uuEntrada), BENCHMARKS.qualityVisit), null, "≥15s Y ≥50% scroll"),
    row("ctav", "CTA viewed", uuCtaView, eventCount("cta.view"), verdict(safePct(uuCtaView, uuEntrada), BENCHMARKS.ctaView), null, "Llegó a ver el CTA"),
    row("ctac", "CTA clicked", uuCtaClick, eventCount("cta.click"),
        verdict(uuCtaView ? safePct(uuCtaClick, uuCtaView) : null, BENCHMARKS.ctaClickRate),
        null, "Sobre los que lo VEN"),
    row("fs", "Form started", uuFormStart, eventCount("form.start"), pctVerdict(uuFormStart, uuEntrada, 12), null, "Primer campo enfocado"),
    row("fsub", "Form submitted", uuFormSubmit, eventCount("form.submit"),
        verdict(uuFormStart ? safePct(uuFormSubmit, uuFormStart) : null, BENCHMARKS.formCompletion),
        null, "Sobre form started"),
    row("vc", "ViewContent (oferta)", uuOffer, eventCount("quality.offer_viewed"), pctVerdict(uuOffer, uuEntrada, 25), null, "Dwell real en precio"),
    row("atc", "AddToCart / Checkout", null, null, unmeasured("No aplica: negocio de servicios, sin carrito"), null, "No aplica a este modelo"),
    row("purchase", "Purchase → Lead (proxy)", leads, eventCount("lead.whatsapp_submitted"), pctVerdict(leads, uuEntrada, 3), null, "Lead es el Purchase aquí"),
    // Inverted metric: the bar shows the problem, so more fill = worse.
    row("rage", "Rage / dead click", uuRage, eventCount("friction.rage_click") + eventCount("friction.dead_click"),
        uuRage === 0
          ? { light: "green", attainment: 1, reason: "Sin fricción detectada" }
          : { light: uuRage / uuEntrada > 0.05 ? "red" : "yellow",
              attainment: 1 - uuRage / uuEntrada,
              reason: `${((uuRage / uuEntrada) * 100).toFixed(1)}% de UU con fricción` },
        null, "Menos es mejor · barra invertida",
        Math.min(1, (uuRage / uuEntrada) / 0.1)),
    row("emq", "EMQ (estimado)", null, null, verdict(emq.score, BENCHMARKS.emq), null,
        `Techo estimado ${emq.score}/10`, emq.score / 10),
    row("dedup", "Pixel↔CAPI", null, dedup.total || null,
        verdict(dedup.matchRate, BENCHMARKS.dedup, { fires: dedup.total }), null,
        dedup.total ? "Match real, no asumido" : "Sin datos server-side",
        dedup.matchRate === null ? null : dedup.matchRate / 100),
    row("pvr", "PageView events/UU", uuEntrada, pvEvents,
        verdict(pvRatio, BENCHMARKS.pageViewRatio), null, "Fuera de rango = doble disparo",
        pvRatio === null ? null : Math.min(1, pvRatio / 1.3)),
  ];

  // ---- timing histogram --------------------------------------------------
  const bands = [
    { label: "0-1.5s", min: 0, max: 1500 }, { label: "1.5-3s", min: 1500, max: 3000 },
    { label: "3-8s", min: 3000, max: 8000 }, { label: "8-20s", min: 8000, max: 20000 },
    { label: "20-45s", min: 20000, max: 45000 }, { label: "45s+", min: 45000, max: Infinity },
  ];
  const timing = bands.map((b) => {
    const uu = visitors.filter((v) => v.survivedMs >= b.min && v.survivedMs < b.max).length;
    return { label: b.label, uu, pct: safePct(uu, uuEntrada) ?? 0 };
  });

  // ---- section funnel ----------------------------------------------------
  const dwellBySection = new Map<string, { uu: Set<string>; ms: number[] }>();
  for (const r of sectionDwellRows) {
    if (!r.sectionId) continue;
    const e = dwellBySection.get(r.sectionId) ?? { uu: new Set<string>(), ms: [] };
    e.uu.add(r.visitorId);
    try { e.ms.push(Number(JSON.parse(r.metadata).dwellMs ?? 0)); } catch { /* ignore */ }
    dwellBySection.set(r.sectionId, e);
  }
  const sections = SECTION_LABELS.map((s) => {
    const d = dwellBySection.get(s.id);
    const uu = d?.uu.size ?? 0;
    const p = safePct(uu, uuEntrada);
    const v: Verdict = d
      ? (p! >= 50 ? { light: "green", attainment: p! / 100, reason: "Alcance sano" }
        : p! >= 25 ? { light: "yellow", attainment: p! / 100, reason: "Alcance medio" }
        : { light: "red", attainment: p! / 100, reason: "Caída fuerte" })
      : { light: "black", attainment: null, reason: "Sin dwell registrado" };
    return {
      id: s.id, label: s.label, uu, pct: p,
      medianDwellMs: d ? median(d.ms) : null,
      light: v.light, friction: s.friction, fix: s.fix,
    };
  });

  // ---- median-UU timeline ------------------------------------------------
  const t50 = scrollTimingAt(50);
  const timeline = [
    { t: "0.0s",  sees: "Hero + nav",            does: "Carga",                 event: "page.view",          firing: pvEvents > 0 },
    { t: "0.8s",  sees: "Titular completo",      does: "Primer scroll",         event: "scroll.depth_25",    firing: uuS25 > 0 },
    { t: "1.6s",  sees: "Subtítulo + CTA",       does: "Evalúa la promesa",     event: "cta.view",           firing: uuCtaView > 0 },
    { t: "3s",    sees: "Sección problema",      does: "Sigue o rebota",        event: "time.survived_3s",   firing: uu3 > 0 },
    { t: "8s",    sees: "El sistema",            does: "Lee bloques",           event: "time.survived_8s",   firing: uu8 > 0 },
    { t: median2s(t50), sees: "Mitad de página", does: "Compara",               event: "scroll.depth_50",    firing: uuS50 > 0 },
    { t: "15s",   sees: "Precio",                does: "Ancla valor",           event: "quality.visit",      firing: uuQuality > 0 },
    { t: "24s+",  sees: "FAQ / formulario",      does: "Convierte o sale",      event: "lead.whatsapp_submitted", firing: leads > 0 },
  ];

  // ---- Meta signal split -------------------------------------------------
  const { EVENTS } = await import("@/lib/tracking/taxonomy");
  const specs = Object.entries(EVENTS) as [string, { meta?: string; metaRole?: string }][];
  const optimize = specs.filter(([, s]) => s.metaRole === "optimize" && s.meta)
    .map(([name, s]) => ({ name, meta: s.meta!, fires: eventCount(name), uu: 0 }));
  const reporting = specs.filter(([, s]) => s.metaRole === "reporting" && s.meta)
    .map(([name, s]) => ({ name, meta: s.meta!, fires: eventCount(name) }));

  const gaps: string[] = [];
  for (const o of optimize) if (o.fires === 0) gaps.push(`${o.meta} (${o.name}) — 0 disparos`);
  if (dedup.pixelOnly > 0) gaps.push(`${dedup.pixelOnly} eventos sin contraparte CAPI`);
  if (!anyLead) gaps.push("Sin Lead en el periodo: em/ph ausentes, EMQ tocado a la baja");

  if (uu3 === 0 && uuEntrada > 0) dataGaps.push("Buckets de supervivencia sin datos: visitantes previos a la instrumentación");

  return {
    meta: {
      from: f.from.toISOString(), to: f.to.toISOString(),
      segment: segmentLabel(f),
      uuEntrada, sessions, totalEvents,
      sessionsPerUu: uuEntrada ? Math.round((sessions / uuEntrada) * 100) / 100 : null,
      generatedAt: new Date().toISOString(),
      source: "first-party collector + Prisma",
    },
    score, movements, timing, sections, timeline,
    emq: { ...emq, benchmark: verdict(emq.score, BENCHMARKS.emq) },
    dedup: { ...dedup, benchmark: verdict(dedup.matchRate, BENCHMARKS.dedup, { fires: dedup.total }) },
    metaSignal: { optimize, reporting, gaps },
    dataGaps,
  };
}

// ---------------------------------------------------------------------------
function safePctRatio(n: number, d: number): number | null {
  return d === 0 ? null : n / d;
}

function pctVerdict(n: number, d: number, targetPct: number): Verdict {
  if (d === 0) return { light: "black", attainment: null, reason: "Sin UU en el segmento" };
  const value = (n / d) * 100;
  const a = value / targetPct;
  if (n === 0) return { light: "red", attainment: 0, reason: "0 disparos" };
  if (a >= 0.7) return { light: "green", attainment: a, reason: `${(a * 100).toFixed(0)}% del objetivo` };
  if (a >= 0.4) return { light: "yellow", attainment: a, reason: `${(a * 100).toFixed(0)}% del objetivo` };
  return { light: "red", attainment: a, reason: `${(a * 100).toFixed(0)}% del objetivo` };
}

function medianOf(visitors: { survivedMs: number }[], threshold: number): number | null {
  const xs = visitors.filter((v) => v.survivedMs >= threshold).map((v) => v.survivedMs);
  return median(xs);
}

function median2s(ms: number | null): string {
  return ms === null ? "—" : ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function segmentLabel(f: Filter): string {
  const parts = [f.trafficType ?? "todo el tráfico", f.deviceType ?? "todos los dispositivos"];
  return parts.join(" · ");
}

function emptyReport(f: Filter, why: string): LabReport {
  const black: Verdict = { light: "black", attainment: null, reason: why };
  const labels = [
    "UU entrada", "Bounce", "Survived 3s", "Survived 8s", "Survived 15s", "Survived 30s",
    "Scroll 25", "Scroll 50", "Scroll 75", "Scroll 90", "Quality Visit",
    "CTA viewed", "CTA clicked", "Form started", "Form submitted",
    "ViewContent (oferta)", "AddToCart / Checkout", "Purchase → Lead (proxy)",
    "Rage / dead click", "EMQ (estimado)", "Pixel↔CAPI", "PageView events/UU",
  ];
  return {
    meta: {
      from: f.from.toISOString(), to: f.to.toISOString(), segment: segmentLabel(f),
      uuEntrada: 0, sessions: 0, totalEvents: 0, sessionsPerUu: null,
      generatedAt: new Date().toISOString(), source: "first-party collector + Prisma",
    },
    score: { score: null, coverage: 0, measured: [], missing: [], contributions: [], confidence: "sin datos" },
    movements: labels.map((label, i) => ({
      key: `empty-${i}`, label, uu: null, pct: null, events: null, eventsPerUu: null,
      verdict: black, ratio: null, medianMs: null, note: "Sin medición",
    })),
    timing: [], sections: [], timeline: [],
    emq: { ...estimateEmq({}), benchmark: black },
    dedup: { ...dedupHealth([]), benchmark: black },
    metaSignal: { optimize: [], reporting: [], gaps: [why] },
    dataGaps: [why],
  };
}
