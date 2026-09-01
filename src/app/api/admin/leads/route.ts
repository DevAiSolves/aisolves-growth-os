import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const temp = req.nextUrl.searchParams.get("temperature");
  const stage = req.nextUrl.searchParams.get("stage");

  const [leads, visitors, totals] = await Promise.all([
    prisma.lead.findMany({
      where: {
        ...(stage ? { stage } : {}),
        ...(temp ? { temperatureAtCapture: temp } : {}),
      },
      orderBy: [{ scoreAtCapture: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: { visitor: true, packages: { include: { package: true } } },
    }),
    prisma.visitor.findMany({
      where: { temperature: { in: ["HOT", "MQL", "SQL"] }, leadId: null },
      orderBy: { score: "desc" },
      take: 50,
    }),
    prisma.visitor.groupBy({ by: ["temperature"], _count: true }),
  ]);

  return NextResponse.json({
    ok: true,
    leads: leads.map((l) => ({ ...l, behaviorSnapshot: JSON.parse(l.behaviorSnapshot) })),
    anonymousHot: visitors,
    distribution: totals,
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const { id, stage, ownerNote } = await req.json();
  const lead = await prisma.lead.update({
    where: { id },
    data: { ...(stage ? { stage } : {}), ...(ownerNote !== undefined ? { ownerNote } : {}) },
  });
  return NextResponse.json({ ok: true, lead });
}
