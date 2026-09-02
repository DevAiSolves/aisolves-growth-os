/**
 * SYNTHETIC TRAFFIC GENERATOR — DEVELOPMENT ONLY
 * ---------------------------------------------------------------------------
 * Generates plausible visitors, sessions and event streams so the TRAFFIC LAB
 * dashboard can be reviewed and demoed before real traffic exists.
 *
 * This data is FAKE. It is deliberately labelled: every generated visitor gets
 * `anonId` prefixed `synthetic-`, so it can be deleted in one query and can
 * never be mistaken for measured behaviour.
 *
 *   npm run seed:traffic         # add 400 synthetic visitors
 *   npm run seed:traffic -- --clean   # remove them all
 *
 * Refuses to run against a non-local DATABASE_URL.
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const PREFIX = "synthetic-";

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const chance = (p: number) => Math.random() < p;

async function clean() {
  const vs = await prisma.visitor.findMany({ where: { anonId: { startsWith: PREFIX } }, select: { id: true } });
  const ids = vs.map((v) => v.id);
  await prisma.event.deleteMany({ where: { visitorId: { in: ids } } });
  await prisma.visitSession.deleteMany({ where: { visitorId: { in: ids } } });
  await prisma.scoreSnapshot.deleteMany({ where: { visitorId: { in: ids } } });
  await prisma.lead.deleteMany({ where: { visitorId: { in: ids } } });
  await prisma.visitor.deleteMany({ where: { id: { in: ids } } });
  console.log(`Removed ${ids.length} synthetic visitors.`);
}

const SECTIONS = ["hero", "problem", "engine", "services", "method", "packages", "faq", "contact"];

async function generate(n: number) {
  const now = Date.now();
  let leads = 0;

  for (let i = 0; i < n; i++) {
    // Paid traffic bounces harder and reads less. That asymmetry is the whole
    // reason the dashboard refuses to blend the two segments.
    const traffic = chance(0.55) ? "paid" : chance(0.5) ? "organic" : pick(["direct", "social", "referral"]);
    const device = chance(0.62) ? "mobile" : "desktop";
    const isPaid = traffic === "paid";

    const bounceP = isPaid ? 0.42 : 0.24;
    const bounced = chance(bounceP);
    const activeMs = bounced ? rnd(300, 2800)
      : device === "mobile" ? rnd(4000, 62000) : rnd(6000, 95000);
    const scroll = bounced ? Math.round(rnd(3, 24))
      : Math.min(100, Math.round(activeMs / 1000 * rnd(1.6, 3.4)));

    const createdAt = new Date(now - rnd(0, 29) * 864e5);
    const anonId = PREFIX + randomUUID();

    const scrollTimings: Record<number, number> = {};
    for (const m of [25, 50, 75, 90, 100]) {
      if (scroll >= m) scrollTimings[m] = Math.round((m / 100) * activeMs * rnd(0.7, 1.25));
    }

    const qualityVisit = activeMs >= 15000 && scroll >= 50;
    const ctaViewed = scroll >= 20;
    const ctaClicked = ctaViewed && chance(qualityVisit ? 0.17 : 0.04);
    const formStarted = ctaClicked && chance(0.4);
    const formSubmitted = formStarted && chance(0.42);

    const visitor = await prisma.visitor.create({
      data: {
        anonId, createdAt, lastSeen: createdAt,
        trafficType: traffic, deviceType: device,
        os: pick(["iOS", "Android", "macOS", "Windows"]),
        browser: pick(["Chrome", "Safari", "Firefox", "Edge"]),
        countryCode: pick(["ES", "MX", "AR", "CO", "CL"]),
        identityStage: formSubmitted ? "identified" : chance(0.35) ? "consented" : "anonymous",
        consentGranted: chance(0.55), consentAds: chance(0.5), consentAnalytics: chance(0.55),
        firstUtmSource: isPaid ? pick(["fb", "ig", "google"]) : null,
        firstUtmMedium: isPaid ? pick(["cpc", "paid_social"]) : null,
        firstFbclid: isPaid && chance(0.7) ? randomUUID().slice(0, 20) : null,
        sessionCount: chance(0.22) ? 2 : 1,
        totalActiveMs: Math.round(activeMs),
        survivedMs: Math.round(activeMs),
        maxScrollDepth: scroll,
        scrollTimings: JSON.stringify(scrollTimings),
        timeToFirstEvent: Math.round(rnd(180, 1900)),
        qualityVisit, bounced, hasInteracted: ctaClicked || formStarted,
        offerViewed: scroll >= 70 && activeMs > 18000,
        ctaViews: ctaViewed ? 1 : 0,
        ctaClicks: ctaClicked ? 1 : 0,
        ctaHovers: ctaViewed && chance(0.3) ? 1 : 0,
        formStarts: formStarted ? 1 : 0,
        formSubmits: formSubmitted ? 1 : 0,
        rageClicks: chance(0.06) ? Math.round(rnd(1, 4)) : 0,
        jsErrors: chance(0.04) ? 1 : 0,
        pricingViews: scroll >= 70 ? Math.round(rnd(1, 3)) : 0,
        score: Math.round(rnd(5, 92)),
        temperature: qualityVisit ? pick(["HOT", "MQL", "WARM"]) : bounced ? "COLD" : "WARM",
      },
    });

    const session = await prisma.visitSession.create({
      data: {
        visitorId: visitor.id, startedAt: createdAt,
        trafficType: traffic, deviceType: device,
        entryPage: "/", activeMs: Math.round(activeMs), survivedMs: Math.round(activeMs),
        maxScrollPct: scroll, qualityVisit, isBounce: bounced,
      },
    });

    // ---- event stream -----------------------------------------------------
    const ev: { name: string; category: string; weight: number; sectionId?: string; meta?: Record<string, unknown> }[] = [];
    ev.push({ name: "page.view", category: "page", weight: 1 });

    for (const [ms, name] of [[3000, "time.survived_3s"], [8000, "time.survived_8s"],
                               [15000, "time.survived_15s"], [30000, "time.survived_30s"],
                               [45000, "time.survived_45s"]] as [number, string][]) {
      if (activeMs >= ms) ev.push({ name, category: "timing", weight: 2, meta: { activeMs: Math.round(activeMs) } });
    }
    for (const m of [25, 50, 75, 90, 100]) {
      if (scroll >= m) ev.push({ name: `scroll.depth_${m}`, category: "scroll", weight: 2, meta: { pct: m, msToReach: scrollTimings[m] } });
    }
    const reached = SECTIONS.slice(0, Math.max(1, Math.round((scroll / 100) * SECTIONS.length)));
    for (const sec of reached) {
      const dwell = Math.round(rnd(1500, 14000));
      ev.push({ name: "section.enter", category: "section", weight: 1, sectionId: sec });
      ev.push({ name: "section.dwell", category: "section", weight: 4, sectionId: sec, meta: { dwellMs: dwell } });
      if (chance(0.3)) ev.push({ name: "block.enter", category: "block", weight: 0, sectionId: sec });
    }
    if (qualityVisit) ev.push({ name: "quality.visit", category: "quality", weight: 8, meta: { activeMs: Math.round(activeMs), scrollPct: scroll } });
    if (visitor.offerViewed) ev.push({ name: "quality.offer_viewed", category: "quality", weight: 7, sectionId: "packages" });
    if (bounced) ev.push({ name: "quality.bounce", category: "quality", weight: 0 });
    if (ctaViewed) ev.push({ name: "cta.view", category: "cta", weight: 1 });
    if (ctaClicked) ev.push({ name: "cta.click", category: "cta", weight: 7 });
    if (formStarted) ev.push({ name: "form.start", category: "form", weight: 5 });
    if (formSubmitted) {
      ev.push({ name: "form.submit", category: "form", weight: 9 });
      ev.push({ name: "lead.whatsapp_submitted", category: "lead", weight: 10 });
    }
    if (visitor.rageClicks) ev.push({ name: "friction.rage_click", category: "friction", weight: 0 });
    if (visitor.jsErrors) ev.push({ name: "friction.js_error", category: "friction", weight: 0 });

    const { getSpec } = await import("../src/lib/tracking/taxonomy");
    await prisma.event.createMany({
      data: ev.map((e, k) => {
        const spec = getSpec(e.name);
        const serverSent = Boolean(spec?.serverSide) && visitor.consentAds;
        return {
          eventId: randomUUID(),
          visitorId: visitor.id, sessionId: session.id,
          name: e.name, category: e.category, weight: e.weight,
          sectionId: e.sectionId, path: "/",
          metadata: JSON.stringify(e.meta ?? {}),
          occurredAt: new Date(createdAt.getTime() + k * 900),
          metaRole: spec?.metaRole ?? null,
          // ~28% of browser pixel calls blocked — the real-world rate this
          // whole architecture exists to recover.
          pixelFired: Boolean(spec?.meta) && visitor.consentAds && chance(0.72),
          sentToMeta: serverSent,
        };
      }),
    });

    await prisma.visitor.update({ where: { id: visitor.id }, data: { totalEvents: ev.length } });
    await prisma.visitSession.update({ where: { id: session.id }, data: { eventCount: ev.length } });

    if (formSubmitted) {
      leads++;
      await prisma.lead.create({
        data: {
          visitorId: visitor.id, name: `Synthetic ${i}`, whatsapp: `+3460000${String(i).padStart(4, "0")}`,
          source: "whatsapp_widget", scoreAtCapture: visitor.score,
          temperatureAtCapture: visitor.temperature, createdAt,
          behaviorSnapshot: JSON.stringify({ synthetic: true, score: visitor.score }),
        },
      });
    }
  }
  console.log(`Generated ${n} synthetic visitors, ${leads} leads.`);
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^file:|localhost|127\.0\.0\.1/.test(url)) {
    console.error("Refusing to seed synthetic traffic into a non-local database.");
    process.exit(1);
  }
  if (process.argv.includes("--clean")) { await clean(); return; }
  await clean();
  await generate(Number(process.argv[2]) || 400);
}

main().finally(() => prisma.$disconnect());
