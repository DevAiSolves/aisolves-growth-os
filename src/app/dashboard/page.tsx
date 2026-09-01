import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Nav } from "@/components/site/Nav";
import { brand } from "@/lib/brand";
import { routingFor } from "@/lib/tracking/scoring";
import type { Temperature } from "@/lib/tracking/types";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = (session.user as { id?: string }).id!;
  const role = (session.user as { role?: string }).role;

  const [profile, visitor] = await Promise.all([
    prisma.clientProfile.findUnique({
      where: { userId },
      include: { connections: true, packages: { include: { package: true } } },
    }),
    prisma.visitor.findFirst({
      where: { userId },
      orderBy: { lastSeen: "desc" },
      include: { events: { orderBy: { occurredAt: "desc" }, take: 15 } },
    }),
  ]);

  const temp = (visitor?.temperature ?? "COLD") as Temperature;
  const routing = routingFor(temp);

  return (
    <>
      <Nav />
      <main className="shell min-h-screen pt-[110px] pb-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="t-mono blue mb-3">Tu cuenta</p>
            <h1 className="t-h1">{profile?.company || session.user.name}</h1>
          </div>
          <div className="flex gap-3">
            {role === "admin" && (
              <Link href="/dashboard/admin" className="btn btn-ghost" data-track-cta="to-admin">
                <span>Vista agencia →</span>
              </Link>
            )}
            <Link href="/onboarding" className="btn btn-ghost" data-track-cta="edit-onboarding">
              <span>Editar accesos</span>
            </Link>
          </div>
        </div>

        {/* ---- behavioural summary ---- */}
        <div className="grid gap-px md:grid-cols-4" style={{ background: "var(--line)" }}>
          {[
            { k: "Score conductual", v: `${visitor?.score ?? 0}/100` },
            { k: "Temperatura", v: temp },
            { k: "Sesiones", v: String(visitor?.sessionCount ?? 0) },
            { k: "Señales", v: String(visitor?.totalEvents ?? 0) },
          ].map((m) => (
            <div key={m.k} className="p-6" style={{ background: brand.color.ink }}>
              <p className="t-mono mb-2 opacity-45">{m.k}</p>
              <p className="t-h2 blue" style={{ fontSize: "1.7rem" }}>{m.v}</p>
            </div>
          ))}
        </div>

        <div className="card mt-8 p-6">
          <p className="t-mono blue mb-2">Acción recomendada por el sistema</p>
          <p className="t-h3 mb-1">{routing.action}</p>
          <p className="t-body opacity-60">SLA {routing.sla} · Canal: {routing.channel}</p>
        </div>

        {/* ---- assets ---- */}
        <h2 className="t-h2 mt-16 mb-6" style={{ fontSize: "1.6rem" }}>Activos conectados</h2>
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--line)" }}>
          {["meta_business", "google_business", "website", "tiktok"].map((p) => {
            const c = profile?.connections.find((x) => x.provider === p);
            const labels: Record<string, string> = {
              meta_business: "Meta Business", google_business: "Google Business",
              website: "Web", tiktok: "TikTok",
            };
            return (
              <div key={p} className="p-6" style={{ background: brand.color.ink }}>
                <p className="t-mono mb-3 opacity-45">{labels[p]}</p>
                <p className="text-[13px]" style={{ color: c?.status === "connected" ? brand.color.blue : "rgba(255,245,239,0.4)" }}>
                  {c?.status === "connected" ? "● Conectado" : c ? "○ Solicitado" : "○ Sin conectar"}
                </p>
                {c?.externalName && <p className="mt-1 truncate text-[12px] opacity-50">{c.externalName}</p>}
              </div>
            );
          })}
        </div>

        {/* ---- packages ---- */}
        <h2 className="t-h2 mt-16 mb-6" style={{ fontSize: "1.6rem" }}>Tu paquete</h2>
        {profile?.packages.length ? (
          <div className="grid gap-px md:grid-cols-2" style={{ background: "var(--line)" }}>
            {profile.packages.map((cp) => (
              <div key={cp.id} className="p-7" style={{ background: brand.color.ink }}>
                <p className="t-mono blue mb-2">{cp.status}</p>
                <h3 className="t-h3 mb-2">{cp.package.name}</h3>
                <p className="t-body mb-3 opacity-60">{cp.package.tagline}</p>
                <p className="t-h3">{cp.mrr.toLocaleString("es-ES")} €<span className="t-mono ml-1.5 opacity-45">/mes</span></p>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-7">
            <p className="t-body mb-4 opacity-65">
              Todavía no hay un paquete asignado. Tu diagnóstico determina cuál encaja.
            </p>
            <a href={`https://wa.me/${brand.whatsapp}`} target="_blank" rel="noopener noreferrer"
              className="btn btn-primary" data-track-cta="dashboard-whatsapp">
              <span>Solicitar diagnóstico →</span>
            </a>
          </div>
        )}

        {/* ---- recent behaviour ---- */}
        <h2 className="t-h2 mt-16 mb-6" style={{ fontSize: "1.6rem" }}>Tu actividad reciente</h2>
        <div className="hairline-t">
          {visitor?.events.length ? visitor.events.map((e) => (
            <div key={e.id} className="hairline-b flex items-center justify-between gap-4 py-3">
              <span className="t-mono opacity-70">{e.name}</span>
              <span className="text-[12px] opacity-45">
                {e.sectionId ?? e.path} · {new Date(e.occurredAt).toLocaleTimeString("es-ES")}
              </span>
            </div>
          )) : <p className="t-body py-6 opacity-50">Sin actividad registrada todavía.</p>}
        </div>
      </main>
    </>
  );
}
