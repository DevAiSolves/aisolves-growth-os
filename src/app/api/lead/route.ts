import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendToMeta } from "@/lib/capi/meta";
import { routingFor } from "@/lib/tracking/scoring";
import type { Temperature } from "@/lib/tracking/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  anonId: z.string().min(8).max(64),
  name: z.string().min(2).max(80),
  whatsapp: z.string().min(7).max(24),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().max(120).optional(),
  website: z.string().max(200).optional(),
  source: z.string().max(40).default("whatsapp_widget"),
  eventId: z.string().max(64).optional(),
});

export async function POST(req: NextRequest) {
  let body;
  try { body = Schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ ok: false, error: "invalid payload", detail: String(e) }, { status: 400 }); }

  const visitor = await prisma.visitor.findUnique({
    where: { anonId: body.anonId },
    include: {
      events: { orderBy: { occurredAt: "desc" }, take: 200 },
      sessions: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });

  // Freeze the behavioural profile at capture time. This is what makes the
  // lead defensible: we can prove *why* it was qualified, months later.
  const sectionDwell: Record<string, number> = {};
  let topSection = "—";
  if (visitor) {
    for (const e of visitor.events) {
      if (e.name !== "section.dwell" || !e.sectionId) continue;
      try {
        const ms = Number(JSON.parse(e.metadata).dwellMs ?? 0);
        sectionDwell[e.sectionId] = Math.max(sectionDwell[e.sectionId] ?? 0, ms);
      } catch { /* ignore */ }
    }
    topSection = Object.entries(sectionDwell).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  }

  const snapshot = {
    score: visitor?.score ?? 0,
    temperature: visitor?.temperature ?? "COLD",
    breakdown: {
      intent: visitor?.scoreIntent ?? 0,
      engage: visitor?.scoreEngage ?? 0,
      fit: visitor?.scoreFit ?? 0,
      identity: visitor?.scoreIdentity ?? 0,
    },
    signals: JSON.parse(visitor?.signals ?? "[]"),
    sessions: visitor?.sessionCount ?? 1,
    activeMs: visitor?.totalActiveMs ?? 0,
    maxScroll: visitor?.maxScrollDepth ?? 0,
    totalEvents: visitor?.totalEvents ?? 0,
    sectionDwell,
    topSection,
    device: visitor?.deviceType,
    country: visitor?.countryCode,
    firstTouch: {
      source: visitor?.firstUtmSource, medium: visitor?.firstUtmMedium,
      campaign: visitor?.firstUtmCampaign, referrer: visitor?.firstReferrer,
    },
    capturedAt: new Date().toISOString(),
  };

  const lead = await prisma.lead.create({
    data: {
      visitorId: visitor?.id,
      name: body.name,
      whatsapp: body.whatsapp,
      email: body.email || null,
      company: body.company || null,
      website: body.website || null,
      source: body.source,
      scoreAtCapture: snapshot.score,
      temperatureAtCapture: snapshot.temperature,
      behaviorSnapshot: JSON.stringify(snapshot),
    },
  });

  if (visitor) {
    await prisma.visitor.update({
      where: { id: visitor.id },
      data: { identityStage: "identified", leadId: lead.id },
    });
  }

  // Server-side Lead event with hashed PII — a much stronger match signal than
  // the browser Pixel can produce on its own.
  let capi: unknown = { skipped: true };
  if (visitor?.consentAds) {
    capi = await sendToMeta([{
      eventName: "lead.whatsapp_submitted",
      eventId: body.eventId ?? `lead-${lead.id}`,
      eventTime: Math.floor(Date.now() / 1000),
      actionSource: "website",
      user: {
        phone: body.whatsapp,
        email: body.email || undefined,
        firstName: body.name.split(" ")[0],
        externalId: body.anonId,
        clientIpAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        clientUserAgent: req.headers.get("user-agent") ?? undefined,
        country: visitor.countryCode ?? undefined,
      },
      custom: { value: snapshot.score, lead_score: snapshot.score, temperature: snapshot.temperature },
    }]);
  }

  const routing = routingFor(snapshot.temperature as Temperature);

  return NextResponse.json({
    ok: true,
    leadId: lead.id,
    report: snapshot,
    routing,
    capi,
  });
}
