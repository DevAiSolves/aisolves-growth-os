import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  anonId: z.string().min(8).max(64),
  granted: z.boolean(),
  analytics: z.boolean().default(true),
  ads: z.boolean().default(true),
  personalization: z.boolean().default(true),
  method: z.enum(["google_login", "explicit_accept", "declined"]),
});

/**
 * Records the consent decision AND — when a session exists — binds the
 * anonymous behavioural history to the authenticated user. This is the
 * identity-stitching step: without it every pre-login behaviour is orphaned.
 */
export async function POST(req: NextRequest) {
  let body;
  try { body = Schema.parse(await req.json()); }
  catch { return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 }); }

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const stage = body.method === "google_login" ? "authenticated"
    : body.granted ? "consented" : "anonymous";

  const visitor = await prisma.visitor.upsert({
    where: { anonId: body.anonId },
    create: {
      anonId: body.anonId,
      identityStage: stage,
      consentGranted: body.granted,
      consentAnalytics: body.analytics,
      consentAds: body.ads,
      consentPersonal: body.personalization,
      consentMethod: body.method,
      consentAt: new Date(),
      userId: userId ?? null,
    },
    update: {
      identityStage: stage,
      consentGranted: body.granted,
      consentAnalytics: body.analytics,
      consentAds: body.ads,
      consentPersonal: body.personalization,
      consentMethod: body.method,
      consentAt: new Date(),
      ...(userId ? { userId } : {}),
    },
  });

  return NextResponse.json({ ok: true, visitorId: visitor.id, identityStage: stage, linkedToUser: Boolean(userId) });
}
