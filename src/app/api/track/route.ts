import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSpec, SERVER_SIDE_EVENTS } from "@/lib/tracking/taxonomy";
import { classifyTrafficServer } from "@/lib/analytics/traffic";
import { scoreVisitor, temperatureFor } from "@/lib/tracking/scoring";
import { sendToMeta, type CapiEvent } from "@/lib/capi/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EventSchema = z.object({
  eventId: z.string().min(8).max(64),
  name: z.string().min(3).max(64),
  category: z.string().max(32),
  weight: z.number().int().min(0).max(10),
  occurredAt: z.number(),
  path: z.string().max(512),
  sectionId: z.string().max(64).optional(),
  blockId: z.string().max(64).optional(),
  elementId: z.string().max(64).optional(),
  metadata: z.record(z.unknown()).default({}),
});

const PayloadSchema = z.object({
  anonId: z.string().min(8).max(64),
  sessionId: z.string().min(8).max(64),
  events: z.array(EventSchema).max(60),
  activeMs: z.number().optional(),
  maxScroll: z.number().optional(),
  lab: z.object({
    ctaViews: z.number().optional(),
    formSubmits: z.number().optional(),
    jsErrors: z.number().optional(),
    tabHidden: z.number().optional(),
    qualityVisit: z.boolean().optional(),
    offerViewed: z.boolean().optional(),
    bounced: z.boolean().optional(),
    hasInteracted: z.boolean().optional(),
    scrollTimings: z.record(z.number()).optional(),
    timeToFirstEvent: z.number().nullable().optional(),
  }).optional(),
  device: z.record(z.unknown()).optional(),
  attribution: z.record(z.unknown()).optional(),
  consent: z.object({
    granted: z.boolean(),
    analytics: z.boolean(),
    ads: z.boolean(),
    personalization: z.boolean(),
    method: z.string().nullable().optional(),
  }),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
});

const s = (v: unknown) => (typeof v === "string" ? v.slice(0, 255) : undefined);

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = PayloadSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ ok: false, error: "invalid payload", detail: String(err) }, { status: 400 });
  }

  const { anonId, sessionId, events, consent, device = {}, attribution = {}, lab = {} } = parsed;
  const trafficType = classifyTrafficServer(attribution);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const ua = req.headers.get("user-agent") ?? undefined;
  const geo = {
    country: req.headers.get("x-vercel-ip-country") ?? undefined,
    region: req.headers.get("x-vercel-ip-country-region") ?? undefined,
    city: req.headers.get("x-vercel-ip-city") ?? undefined,
  };

  // -------------------------------------------------------------------------
  // 1. Visitor — created on first beacon, before any consent. First-touch
  //    attribution is written once and never overwritten.
  // -------------------------------------------------------------------------
  const visitor = await prisma.visitor.upsert({
    where: { anonId },
    create: {
      anonId,
      identityStage: consent.granted ? "consented" : "anonymous",
      consentGranted: consent.granted,
      consentAnalytics: consent.analytics,
      consentAds: consent.ads,
      consentPersonal: consent.personalization,
      consentMethod: s(consent.method),
      consentAt: consent.granted ? new Date() : null,
      firstUtmSource: s(attribution.utmSource),
      firstUtmMedium: s(attribution.utmMedium),
      firstUtmCampaign: s(attribution.utmCampaign),
      firstUtmContent: s(attribution.utmContent),
      firstUtmTerm: s(attribution.utmTerm),
      firstReferrer: s(attribution.referrer),
      firstLandingPage: s(attribution.landingPage),
      firstFbclid: s(attribution.fbclid),
      firstGclid: s(attribution.gclid),
      firstTtclid: s(attribution.ttclid),
      lastUtmSource: s(attribution.utmSource),
      lastUtmMedium: s(attribution.utmMedium),
      lastUtmCampaign: s(attribution.utmCampaign),
      lastReferrer: s(attribution.referrer),
      deviceType: s(device.deviceType),
      os: s(device.os),
      browser: s(device.browser),
      screenClass: s(device.screenClass),
      language: s(device.language),
      timezone: s(device.timezone),
      connection: s(device.connection),
      prefersDark: Boolean(device.prefersDark),
      reducedMotion: Boolean(device.reducedMotion),
      countryCode: geo.country,
      region: geo.region,
      city: geo.city,
      sessionCount: 1,
      trafficType,
    },
    update: {
      consentGranted: consent.granted,
      consentAnalytics: consent.analytics,
      consentAds: consent.ads,
      consentPersonal: consent.personalization,
      ...(consent.method ? { consentMethod: s(consent.method) } : {}),
      lastUtmSource: s(attribution.utmSource),
      lastUtmMedium: s(attribution.utmMedium),
      lastUtmCampaign: s(attribution.utmCampaign),
      lastReferrer: s(attribution.referrer),
      countryCode: geo.country ?? undefined,
      city: geo.city ?? undefined,
      // First touch decides the traffic type. A paid visitor who returns via
      // direct is still a paid visitor — reclassifying them would let paid
      // campaigns quietly launder their bounce rate into the organic bucket.
    },
  });

  // -------------------------------------------------------------------------
  // 2. Session
  // -------------------------------------------------------------------------
  let session = await prisma.visitSession.findFirst({
    where: { visitorId: visitor.id, id: sessionId },
  });
  if (!session) {
    session = await prisma.visitSession.create({
      data: {
        id: sessionId,
        visitorId: visitor.id,
        entryPage: s(attribution.landingPage) ?? events[0]?.path,
        referrer: s(attribution.referrer),
        utmSource: s(attribution.utmSource),
        utmMedium: s(attribution.utmMedium),
        utmCampaign: s(attribution.utmCampaign),
        trafficType,
        deviceType: s(device.deviceType),
      },
    }).catch(async () =>
      prisma.visitSession.findFirstOrThrow({ where: { id: sessionId } })
    );
    await prisma.visitor.update({
      where: { id: visitor.id },
      data: { sessionCount: { increment: 1 } },
    });
  }

  // -------------------------------------------------------------------------
  // 3. Persist the event stream. `eventId` is unique, so a retried beacon or a
  //    duplicated sendBeacon can never inflate the numbers.
  // -------------------------------------------------------------------------
  await prisma.event.createMany({
    data: events.map((e) => ({
      eventId: e.eventId,
      visitorId: visitor.id,
      sessionId: session!.id,
      name: e.name,
      category: e.category,
      weight: e.weight,
      path: e.path,
      sectionId: e.sectionId,
      blockId: e.blockId,
      elementId: e.elementId,
      metadata: JSON.stringify(e.metadata).slice(0, 4000),
      occurredAt: new Date(e.occurredAt),
      pixelFired: Boolean((e.metadata as Record<string, unknown>)._pixel),
      sentToGa4: Boolean((e.metadata as Record<string, unknown>)._ga4),
      metaRole: getSpec(e.name)?.metaRole ?? null,
    })),
  }).catch(() => { /* unique collisions are expected and harmless */ });

  // -------------------------------------------------------------------------
  // 4. Roll up counters
  // -------------------------------------------------------------------------
  const inc = {
    pricingViews: 0, ctaHovers: 0, ctaClicks: 0, formStarts: 0,
    formAbandons: 0, rageClicks: 0, exitIntents: 0, videoCompletions: 0,
    ctaViews: 0, formSubmits: 0, jsErrors: 0, tabHidden: 0,
  };
  for (const e of events) {
    if (e.name === "cta.hover") inc.ctaHovers++;
    if (e.name === "cta.click" || e.name === "cta.whatsapp_click") inc.ctaClicks++;
    if (e.name === "form.start") inc.formStarts++;
    if (e.name === "form.abandon") inc.formAbandons++;
    if (e.name === "friction.rage_click") inc.rageClicks++;
    if (e.name === "friction.exit_intent") inc.exitIntents++;
    if (e.name === "video.complete") inc.videoCompletions++;
    if (e.name === "cta.view") inc.ctaViews++;
    if (e.name === "form.submit") inc.formSubmits++;
    if (e.name === "friction.js_error") inc.jsErrors++;
    if (e.name === "friction.tab_hidden") inc.tabHidden++;
    if (e.sectionId === "packages" && (e.name === "section.enter" || e.name === "section.revisit")) inc.pricingViews++;
  }

  const sawQuality = events.some((e) => e.name === "quality.visit");
  const sawOffer   = events.some((e) => e.name === "quality.offer_viewed");
  const sawBounce  = events.some((e) => e.name === "quality.bounce");

  const maxScroll = Math.max(visitor.maxScrollDepth, Math.round(parsed.maxScroll ?? 0));
  const activeMs = Math.max(visitor.totalActiveMs, Math.round(parsed.activeMs ?? 0));

  const updated = await prisma.visitor.update({
    where: { id: visitor.id },
    data: {
      totalEvents: { increment: events.length },
      maxScrollDepth: maxScroll,
      totalActiveMs: activeMs,
      pricingViews: { increment: inc.pricingViews },
      ctaHovers: { increment: inc.ctaHovers },
      ctaClicks: { increment: inc.ctaClicks },
      formStarts: { increment: inc.formStarts },
      formAbandons: { increment: inc.formAbandons },
      rageClicks: { increment: inc.rageClicks },
      exitIntents: { increment: inc.exitIntents },
      videoCompletions: { increment: inc.videoCompletions },
      ctaViews: { increment: inc.ctaViews },
      formSubmits: { increment: inc.formSubmits },
      jsErrors: { increment: inc.jsErrors },
      tabHidden: { increment: inc.tabHidden },
      // Quality flags are sticky: once earned in any session they stay earned.
      ...(sawQuality || lab.qualityVisit ? { qualityVisit: true } : {}),
      ...(sawOffer || lab.offerViewed ? { offerViewed: true } : {}),
      ...(sawBounce ? { bounced: true } : {}),
      ...(lab.hasInteracted ? { hasInteracted: true, bounced: false } : {}),
      survivedMs: Math.max(visitor.survivedMs, Math.round(parsed.activeMs ?? 0)),
      ...(lab.timeToFirstEvent != null && visitor.timeToFirstEvent == null
        ? { timeToFirstEvent: Math.round(lab.timeToFirstEvent) } : {}),
      ...(lab.scrollTimings && Object.keys(lab.scrollTimings).length
        ? { scrollTimings: JSON.stringify(lab.scrollTimings).slice(0, 500) } : {}),
    },
  });

  await prisma.visitSession.update({
    where: { id: session.id },
    data: {
      eventCount: { increment: events.length },
      pageViews: { increment: events.filter((e) => e.name === "page.view").length },
      maxScrollPct: Math.max(session.maxScrollPct, Math.round(parsed.maxScroll ?? 0)),
      activeMs: Math.round(parsed.activeMs ?? session.activeMs),
      exitPage: events[events.length - 1]?.path ?? session.exitPage,
      isBounce: sawBounce ? true : lab.hasInteracted ? false : (session.eventCount + events.length) < 5,
      survivedMs: Math.max(session.survivedMs, Math.round(parsed.activeMs ?? 0)),
      ...(sawQuality || lab.qualityVisit ? { qualityVisit: true } : {}),
    },
  }).catch(() => {});

  // -------------------------------------------------------------------------
  // 5. Rescore. Section dwell is read from the persisted stream so the score
  //    reflects every session, not just this batch.
  // -------------------------------------------------------------------------
  const dwellRows = await prisma.event.findMany({
    where: { visitorId: visitor.id, name: "section.dwell" },
    select: { sectionId: true, metadata: true },
    take: 500,
  });
  const sectionDwell: Record<string, number> = {};
  for (const r of dwellRows) {
    if (!r.sectionId) continue;
    let ms = 0;
    try { ms = Number(JSON.parse(r.metadata).dwellMs ?? 0); } catch { /* ignore */ }
    sectionDwell[r.sectionId] = Math.max(sectionDwell[r.sectionId] ?? 0, ms);
  }

  const profile = await prisma.clientProfile.findFirst({
    where: { user: { visitors: { some: { id: visitor.id } } } },
    include: { connections: true },
  });

  const result = scoreVisitor({
    totalActiveMs: updated.totalActiveMs,
    maxScrollDepth: updated.maxScrollDepth,
    sessionCount: updated.sessionCount,
    pricingViews: updated.pricingViews,
    ctaHovers: updated.ctaHovers,
    ctaClicks: updated.ctaClicks,
    formStarts: updated.formStarts,
    formAbandons: updated.formAbandons,
    rageClicks: updated.rageClicks,
    exitIntents: updated.exitIntents,
    videoCompletions: updated.videoCompletions,
    identityStage: updated.identityStage,
    sectionDwell,
    hasWebsite: Boolean(profile?.website),
    hasMetaAccess: profile?.connections.some((c) => c.provider === "meta_business" && c.status === "connected"),
    hasGoogleBusiness: profile?.connections.some((c) => c.provider === "google_business" && c.status === "connected"),
    budgetBand: profile?.monthlyBudget ?? null,
  });

  const crossed = result.temperature !== updated.temperature;
  await prisma.visitor.update({
    where: { id: visitor.id },
    data: {
      score: result.score,
      scoreIntent: result.breakdown.intent,
      scoreEngage: result.breakdown.engage,
      scoreFit: result.breakdown.fit,
      scoreIdentity: result.breakdown.identity,
      temperature: result.temperature,
      signals: JSON.stringify(result.signals),
    },
  });

  if (crossed) {
    await prisma.scoreSnapshot.create({
      data: {
        visitorId: visitor.id,
        score: result.score,
        temperature: result.temperature,
        reason: events[events.length - 1]?.name ?? "batch",
      },
    });
  }

  // -------------------------------------------------------------------------
  // 6. Server-side fan-out. Same event_id as the browser Pixel -> Meta
  //    deduplicates and keeps whichever copy has the better match signal.
  // -------------------------------------------------------------------------
  const capiQueue: CapiEvent[] = events
    .filter((e) => SERVER_SIDE_EVENTS.includes(e.name) && consent.ads)
    .map((e) => ({
      eventName: e.name,
      eventId: e.eventId,
      eventTime: Math.floor(e.occurredAt / 1000),
      eventSourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${e.path}`,
      actionSource: "website" as const,
      user: {
        externalId: anonId,
        fbp: parsed.fbp,
        fbc: parsed.fbc,
        clientIpAddress: ip,
        clientUserAgent: ua,
        country: geo.country,
        city: geo.city,
      },
      custom: {
        content_name: e.sectionId ?? e.path,
        value: e.weight,
        lead_score: result.score,
        temperature: result.temperature,
      },
    }));

  // Server-derived qualification events have no browser counterpart.
  if (crossed && (result.temperature === "MQL" || result.temperature === "SQL") && consent.ads) {
    capiQueue.push({
      eventName: result.temperature === "SQL" ? "qualification.sql" : "qualification.mql",
      eventId: `qual-${visitor.id}-${result.temperature}`,
      eventTime: Math.floor(Date.now() / 1000),
      actionSource: "system_generated",
      user: { externalId: anonId, fbp: parsed.fbp, fbc: parsed.fbc, clientIpAddress: ip, clientUserAgent: ua },
      custom: { value: result.score, lead_score: result.score },
    });
  }

  let capi: unknown = { skipped: true };
  if (capiQueue.length) {
    capi = await sendToMeta(capiQueue);
    await prisma.event.updateMany({
      where: { eventId: { in: capiQueue.map((c) => c.eventId) } },
      data: { sentToMeta: true },
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    accepted: events.length,
    score: result.score,
    temperature: result.temperature,
    breakdown: result.breakdown,
    signals: result.signals,
    crossed,
    capi,
  });
}
