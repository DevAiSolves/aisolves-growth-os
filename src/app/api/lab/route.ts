import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { buildLabReport } from "@/lib/analytics/movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TRAFFIC LAB dataset.
 *
 * Segments are returned separately, never averaged: paid vs organic, mobile vs
 * desktop. A blended bounce rate hides whichever half is broken — which is
 * exactly the half you needed to find.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams;
  const days = Math.min(90, Math.max(1, Number(q.get("days") ?? 30)));
  const to = new Date();
  const from = new Date(to.getTime() - days * 864e5);

  const defs: Record<string, { trafficType?: string; deviceType?: string }> = {
    all: {},
    paid: { trafficType: "paid" },
    organic: { trafficType: "organic" },
    direct: { trafficType: "direct" },
    social: { trafficType: "social" },
    mobile: { deviceType: "mobile" },
    desktop: { deviceType: "desktop" },
  };

  const requested = (q.get("segments") ?? "all,paid,organic,mobile,desktop").split(",");
  const segments: Record<string, unknown> = {};
  for (const seg of requested) {
    if (!defs[seg]) continue;
    segments[seg] = await buildLabReport(prisma, { from, to, ...defs[seg] });
  }

  return NextResponse.json({
    ok: true,
    days,
    period: { from: from.toISOString(), to: to.toISOString() },
    segments,
  });
}
