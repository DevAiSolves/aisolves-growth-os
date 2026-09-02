import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Nav } from "@/components/site/Nav";
import { buildLabReport, type LabReport } from "@/lib/analytics/movements";
import { LabDashboard } from "@/components/lab/LabDashboard";
import "@/app/lab.css";

export const metadata = { title: "Traffic Lab" };
export const dynamic = "force-dynamic";

const DEFS: Record<string, { trafficType?: string; deviceType?: string }> = {
  all: {},
  paid: { trafficType: "paid" },
  organic: { trafficType: "organic" },
  mobile: { deviceType: "mobile" },
  desktop: { deviceType: "desktop" },
};

export default async function LabPage({
  searchParams,
}: { searchParams: Promise<{ days?: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user) redirect("/");
  if (role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const days = Math.min(90, Math.max(1, Number(sp.days ?? 30)));
  const to = new Date();
  const from = new Date(to.getTime() - days * 864e5);

  // Built sequentially: SQLite serialises writes anyway, and five parallel
  // multi-query reports gain nothing while making the query log unreadable.
  const segments: Record<string, LabReport> = {};
  for (const [key, def] of Object.entries(DEFS)) {
    segments[key] = await buildLabReport(prisma, { from, to, ...def });
  }

  return (
    <>
      <Nav />
      <main className="shell" style={{ paddingTop: 110, paddingBottom: 96 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 18 }}>
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/dashboard/lab?days=${d}`} className="chip"
              style={{
                textDecoration: "none",
                borderColor: d === days ? "#0028FF" : "var(--line)",
                color: d === days ? "#FFF5EF" : undefined,
              }}>
              {d}d
            </Link>
          ))}
          <Link href="/dashboard/admin" className="chip" style={{ textDecoration: "none" }}>
            ← Agencia
          </Link>
        </div>

        <LabDashboard segments={segments} days={days} />

        <p style={{ marginTop: 56, fontSize: 11.5, opacity: 0.35, maxWidth: "72ch", lineHeight: 1.7 }}>
          Benchmarks mostrados como <strong>default de industria</strong>, no como ley. Sustitúyelos por
          el histórico del propio cliente en cuanto haya 3-4 semanas de datos: una landing de demo B2B
          y una de eventos nocturnos no comparten tasa de rebote. El EMQ es un techo <strong>estimado</strong> a
          partir de las claves que transmitimos; el real lo calcula Meta y siempre es menor o igual.
        </p>
      </main>
    </>
  );
}
