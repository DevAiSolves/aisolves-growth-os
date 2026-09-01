import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { routingFor } from "@/lib/tracking/scoring";
import type { Temperature } from "@/lib/tracking/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The visitor's own live behavioural report. This is the payload the
 * end-of-scroll widget promises in exchange for a WhatsApp number: we show
 * them exactly what we measured about them. Transparency is the offer.
 */
export async function GET(req: NextRequest) {
  const anonId = req.nextUrl.searchParams.get("anonId");
  if (!anonId) return NextResponse.json({ ok: false, error: "anonId required" }, { status: 400 });

  const visitor = await prisma.visitor.findUnique({
    where: { anonId },
    include: {
      events: { orderBy: { occurredAt: "desc" }, take: 40 },
      snapshots: { orderBy: { createdAt: "asc" }, take: 30 },
    },
  });
  if (!visitor) return NextResponse.json({ ok: true, visitor: null });

  const sectionDwell: Record<string, number> = {};
  for (const e of visitor.events) {
    if (e.name !== "section.dwell" || !e.sectionId) continue;
    try {
      const ms = Number(JSON.parse(e.metadata).dwellMs ?? 0);
      sectionDwell[e.sectionId] = Math.max(sectionDwell[e.sectionId] ?? 0, ms);
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    ok: true,
    visitor: {
      score: visitor.score,
      temperature: visitor.temperature,
      breakdown: {
        intent: visitor.scoreIntent, engage: visitor.scoreEngage,
        fit: visitor.scoreFit, identity: visitor.scoreIdentity,
      },
      signals: JSON.parse(visitor.signals),
      sessionCount: visitor.sessionCount,
      totalEvents: visitor.totalEvents,
      totalActiveMs: visitor.totalActiveMs,
      maxScrollDepth: visitor.maxScrollDepth,
      identityStage: visitor.identityStage,
      device: visitor.deviceType,
      country: visitor.countryCode,
      sectionDwell,
      firstTouch: {
        source: visitor.firstUtmSource ?? (visitor.firstReferrer ? "referral" : "direct"),
        campaign: visitor.firstUtmCampaign,
      },
      recentEvents: visitor.events.slice(0, 12).map((e) => ({
        name: e.name, section: e.sectionId, weight: e.weight, at: e.occurredAt,
      })),
      trajectory: visitor.snapshots.map((s) => ({ score: s.score, temp: s.temperature, at: s.createdAt })),
      routing: routingFor(visitor.temperature as Temperature),
    },
  });
}
