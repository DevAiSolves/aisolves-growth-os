import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  company: z.string().max(120).optional(),
  website: z.string().max(200).optional(),
  industry: z.string().max(80).optional(),
  monthlyBudget: z.string().max(40).optional(),
  whatsapp: z.string().max(24).optional(),
  /** Which asset accesses the client is granting. */
  connections: z.array(z.object({
    provider: z.enum(["meta_business", "google_business", "website", "tiktok", "linkedin"]),
    externalId: z.string().max(120).optional(),
    externalName: z.string().max(160).optional(),
  })).default([]),
  complete: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  let body;
  try { body = Schema.parse(await req.json()); }
  catch (e) { return NextResponse.json({ ok: false, error: "invalid payload", detail: String(e) }, { status: 400 }); }

  const profile = await prisma.clientProfile.upsert({
    where: { userId },
    create: {
      userId,
      company: body.company, website: body.website, industry: body.industry,
      monthlyBudget: body.monthlyBudget, whatsapp: body.whatsapp,
      onboardingStage: body.complete ? "assets_connected" : "assets_requested",
    },
    update: {
      ...(body.company !== undefined ? { company: body.company } : {}),
      ...(body.website !== undefined ? { website: body.website } : {}),
      ...(body.industry !== undefined ? { industry: body.industry } : {}),
      ...(body.monthlyBudget !== undefined ? { monthlyBudget: body.monthlyBudget } : {}),
      ...(body.whatsapp !== undefined ? { whatsapp: body.whatsapp } : {}),
      onboardingStage: body.complete ? "assets_connected" : "assets_requested",
      ...(body.complete ? { activatedAt: new Date() } : {}),
    },
  });

  for (const c of body.connections) {
    await prisma.assetConnection.upsert({
      where: { profileId_provider: { profileId: profile.id, provider: c.provider } },
      create: {
        profileId: profile.id, provider: c.provider,
        externalId: c.externalId, externalName: c.externalName,
        status: c.externalId ? "connected" : "requested",
        connectedAt: c.externalId ? new Date() : null,
      },
      update: {
        externalId: c.externalId, externalName: c.externalName,
        status: c.externalId ? "connected" : "pending",
        connectedAt: c.externalId ? new Date() : null,
      },
    });
  }

  const full = await prisma.clientProfile.findUnique({
    where: { id: profile.id },
    include: { connections: true },
  });

  return NextResponse.json({ ok: true, profile: full });
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const profile = await prisma.clientProfile.findUnique({
    where: { userId },
    include: { connections: true, packages: { include: { package: true } } },
  });
  return NextResponse.json({ ok: true, profile });
}
