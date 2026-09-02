import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Nav } from "@/components/site/Nav";
import { brand } from "@/lib/brand";
import { routingFor } from "@/lib/tracking/scoring";
import type { Temperature } from "@/lib/tracking/types";

export const metadata = { title: "Agencia · Dashboard" };
export const dynamic = "force-dynamic";

const TEMP_COLOR: Record<string, string> = {
  SQL: "#0028FF", MQL: "#3B5BFF", HOT: "#7B8FFF", WARM: "#807B78", COLD: "#4A4744",
};

export default async function AdminDashboard() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user) redirect("/");
  if (role !== "admin") redirect("/dashboard");

  const [leads, hotAnon, distribution, profiles, totals, recentEvents] = await Promise.all([
    prisma.lead.findMany({
      orderBy: [{ scoreAtCapture: "desc" }, { createdAt: "desc" }],
      take: 60,
      include: { visitor: true, packages: { include: { package: true } } },
    }),
    prisma.visitor.findMany({
      where: { temperature: { in: ["HOT", "MQL", "SQL"] }, leadId: null },
      orderBy: { score: "desc" },
      take: 20,
    }),
    prisma.visitor.groupBy({ by: ["temperature"], _count: true }),
    prisma.clientProfile.findMany({
      include: { user: true, connections: true, packages: { include: { package: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.visitor.aggregate({ _count: true, _avg: { score: true, totalActiveMs: true } }),
    prisma.event.groupBy({
      by: ["name"], _count: true,
      orderBy: { _count: { name: "desc" } }, take: 12,
    }),
  ]);

  const dist = Object.fromEntries(distribution.map((d) => [d.temperature, d._count]));
  const mrr = profiles.flatMap((p) => p.packages).reduce((a, cp) => a + cp.mrr, 0);

  return (
    <>
      <Nav />
      <main className="shell min-h-screen pt-[110px] pb-24">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="t-mono blue mb-3">Vista agencia</p>
            <h1 className="t-h1">Inteligencia de comportamiento</h1>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/dashboard/lab" className="btn btn-primary" data-track-cta="to-lab">
              <span>Traffic Lab →</span>
            </Link>
            <Link href="/dashboard" className="btn btn-ghost"><span>← Mi cuenta</span></Link>
          </div>
        </div>

        {/* ---- KPIs ---- */}
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-5" style={{ background: "var(--line)" }}>
          {[
            { k: "Visitantes trackeados", v: totals._count.toLocaleString("es-ES") },
            { k: "Score medio", v: Math.round(totals._avg.score ?? 0) },
            { k: "Leads capturados", v: leads.length },
            { k: "Clientes activos", v: profiles.filter((p) => p.packages.length).length },
            { k: "MRR", v: `${mrr.toLocaleString("es-ES")} €` },
          ].map((m) => (
            <div key={m.k} className="p-6" style={{ background: brand.color.ink }}>
              <p className="t-mono mb-2 opacity-45">{m.k}</p>
              <p className="t-h2 blue" style={{ fontSize: "1.7rem" }}>{m.v}</p>
            </div>
          ))}
        </div>

        {/* ---- temperature funnel ---- */}
        <h2 className="t-h2 mt-14 mb-5" style={{ fontSize: "1.5rem" }}>Distribución por temperatura</h2>
        <div className="flex flex-col gap-2.5">
          {(["SQL", "MQL", "HOT", "WARM", "COLD"] as const).map((t) => {
            const n = dist[t] ?? 0;
            const max = Math.max(...Object.values(dist).map(Number), 1);
            const r = routingFor(t as Temperature);
            return (
              <div key={t} className="flex items-center gap-4">
                <span className="t-mono w-[46px] shrink-0" style={{ color: TEMP_COLOR[t] }}>{t}</span>
                <div className="h-[22px] flex-1" style={{ background: "rgba(255,245,239,0.06)" }}>
                  <div style={{ height: "100%", width: `${Math.max(1, (n / max) * 100)}%`, background: TEMP_COLOR[t] }} />
                </div>
                <span className="t-mono w-[44px] shrink-0 text-right opacity-60">{n}</span>
                <span className="hidden w-[300px] shrink-0 text-[12px] opacity-45 lg:block">{r.action} · {r.sla}</span>
              </div>
            );
          })}
        </div>

        {/* ---- leads ---- */}
        <h2 className="t-h2 mt-14 mb-5" style={{ fontSize: "1.5rem" }}>Leads por prioridad conductual</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="t-mono hairline-b opacity-45">
                {["Score", "Temp", "Nombre", "WhatsApp", "Origen", "Foco de atención", "Señales", "Etapa"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-3 text-left font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 opacity-45">
                  Sin leads todavía. Navega el home hasta el final y envía el widget para generar el primero.
                </td></tr>
              )}
              {leads.map((l) => {
                let snap: Record<string, unknown> = {};
                try { snap = JSON.parse(l.behaviorSnapshot); } catch { /* ignore */ }
                const signals = Array.isArray(snap.signals) ? (snap.signals as string[]) : [];
                return (
                  <tr key={l.id} className="hairline-b align-top">
                    <td className="px-3 py-3">
                      <span className="t-h3 blue">{l.scoreAtCapture}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="chip" style={{ borderColor: TEMP_COLOR[l.temperatureAtCapture], color: TEMP_COLOR[l.temperatureAtCapture] }}>
                        {l.temperatureAtCapture}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{l.name}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <a href={`https://wa.me/${l.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                        className="no-underline blue">{l.whatsapp}</a>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 opacity-60">
                      {(snap.firstTouch as { source?: string })?.source ?? "directo"}
                    </td>
                    <td className="px-3 py-3 opacity-60">{String(snap.topSection ?? "—")}</td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {signals.slice(0, 3).map((s) => (
                          <span key={s} className="chip" style={{ fontSize: "9.5px", padding: "1px 5px" }}>
                            {s.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 opacity-60">{l.stage}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ---- anonymous hot ---- */}
        <h2 className="t-h2 mt-14 mb-2" style={{ fontSize: "1.5rem" }}>Anónimos calientes</h2>
        <p className="t-body mb-5 max-w-[64ch] opacity-60">
          Comportamiento de compra sin identidad resuelta. Son la audiencia de retargeting
          de mayor valor que existe: ya demostraron intención y todavía no dieron el paso.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="t-mono hairline-b opacity-45">
                {["Score", "Temp", "Sesiones", "Atención", "Scroll", "Precio visto", "Origen", "Dispositivo"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-3 text-left font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hotAnon.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 opacity-45">Ninguno todavía.</td></tr>
              )}
              {hotAnon.map((v) => (
                <tr key={v.id} className="hairline-b">
                  <td className="px-3 py-3"><span className="t-h3 blue">{v.score}</span></td>
                  <td className="px-3 py-3">
                    <span className="chip" style={{ borderColor: TEMP_COLOR[v.temperature], color: TEMP_COLOR[v.temperature] }}>
                      {v.temperature}
                    </span>
                  </td>
                  <td className="px-3 py-3 opacity-70">{v.sessionCount}</td>
                  <td className="px-3 py-3 opacity-70">{Math.round(v.totalActiveMs / 1000)}s</td>
                  <td className="px-3 py-3 opacity-70">{v.maxScrollDepth}%</td>
                  <td className="px-3 py-3 opacity-70">{v.pricingViews}×</td>
                  <td className="px-3 py-3 opacity-60">{v.firstUtmSource ?? (v.firstReferrer ? "referral" : "directo")}</td>
                  <td className="px-3 py-3 opacity-60">{v.deviceType ?? "—"} · {v.countryCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- clients ---- */}
        <h2 className="t-h2 mt-14 mb-5" style={{ fontSize: "1.5rem" }}>Clientes y paquetes</h2>
        <div className="grid gap-px md:grid-cols-2 lg:grid-cols-3" style={{ background: "var(--line)" }}>
          {profiles.length === 0 && (
            <div className="p-7 opacity-45" style={{ background: brand.color.ink }}>
              Sin clientes registrados todavía.
            </div>
          )}
          {profiles.map((p) => (
            <div key={p.id} className="p-6" style={{ background: brand.color.ink }}>
              <p className="t-mono blue mb-2">{p.onboardingStage}</p>
              <h3 className="t-h3 mb-1">{p.company || p.user.name || p.user.email}</h3>
              <p className="mb-3 truncate text-[12px] opacity-50">{p.website ?? "sin web"}</p>
              <div className="mb-3 flex flex-wrap gap-1">
                {p.connections.map((c) => (
                  <span key={c.id} className="chip" style={{
                    fontSize: "9.5px", padding: "1px 5px",
                    borderColor: c.status === "connected" ? brand.color.blue : "var(--line)",
                  }}>
                    {c.provider.replace("_", " ")}
                  </span>
                ))}
              </div>
              {p.packages.map((cp) => (
                <p key={cp.id} className="text-[13px]">
                  {cp.package.name} · <span className="blue">{cp.mrr.toLocaleString("es-ES")} €/mes</span>
                  <span className="t-mono ml-2 opacity-45">{cp.status}</span>
                </p>
              ))}
              {!p.packages.length && <p className="text-[12px] opacity-40">Sin paquete asignado</p>}
            </div>
          ))}
        </div>

        {/* ---- event volume ---- */}
        <h2 className="t-h2 mt-14 mb-5" style={{ fontSize: "1.5rem" }}>Eventos más frecuentes</h2>
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--line)" }}>
          {recentEvents.map((e) => (
            <div key={e.name} className="p-5" style={{ background: brand.color.ink }}>
              <p className="t-mono mb-1.5 opacity-45">{e.name}</p>
              <p className="t-h3 blue">{e._count.toLocaleString("es-ES")}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
