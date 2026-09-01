"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { brand } from "@/lib/brand";
import { useTracking } from "@/components/providers/TrackingProvider";

/**
 * STAGE-2 ONBOARDING — asset access.
 *
 * Deliberately sequenced. Asking for Meta Business and Google Business Profile
 * access at first contact destroys conversion; asking after the person is
 * already inside, with a stated reason per asset, does not.
 *
 * Each request states plainly what we read and what we never touch. That
 * framing is what makes the grant rate survive the second screen.
 */

interface Initial {
  company: string; website: string; industry: string;
  monthlyBudget: string; whatsapp: string; stage: string;
  connections: { provider: string; status: string }[];
}

const ASSETS = [
  {
    provider: "meta_business",
    name: "Meta Business",
    why: "Leer rendimiento de campañas, diagnosticar el píxel y activar Conversions API.",
    never: "No publicamos ni modificamos campañas sin tu aprobación explícita.",
    action: "facebook" as const,
  },
  {
    provider: "google_business",
    name: "Google Business Profile",
    why: "Auditar presencia local, reseñas y señales de entidad para SEO, AIO y GEO.",
    never: "No respondemos reseñas en tu nombre.",
    action: "manual" as const,
  },
  {
    provider: "website",
    name: "Tu web actual",
    why: "Medir pérdida de señal real y estimar cuántas conversiones no llegan hoy a Meta.",
    never: "Solo lectura pública. No pedimos acceso a tu hosting.",
    action: "field" as const,
  },
];

const INDUSTRIES = ["Servicios B2B", "SaaS", "E-commerce", "Real estate", "Nightlife / Eventos", "Salud", "Educación", "Otro"];
const BUDGETS = [
  { v: "under_1k", l: "< 1.000 €/mes" },
  { v: "1k_3k", l: "1.000 – 3.000 €" },
  { v: "3k_10k", l: "3.000 – 10.000 €" },
  { v: "over_10k", l: "> 10.000 €" },
];

export function OnboardingFlow({ userName, initial }: { userName: string; initial: Initial }) {
  const router = useRouter();
  const { track } = useTracking();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [connected, setConnected] = useState<Record<string, boolean>>(
    Object.fromEntries(initial.connections.map((c) => [c.provider, c.status === "connected"]))
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(initial.stage === "assets_connected");

  const set = (k: keyof Initial, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function saveProfile() {
    setBusy(true);
    track("onboarding.started", { step: "profile" });
    if (form.website) track("onboarding.website_submitted", { hasWebsite: true });
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: form.company, website: form.website, industry: form.industry,
        monthlyBudget: form.monthlyBudget, whatsapp: form.whatsapp,
        connections: form.website ? [{ provider: "website", externalId: form.website, externalName: form.website }] : [],
      }),
    }).catch(() => {});
    setBusy(false);
    setStep(1);
  }

  async function requestAsset(provider: string, action: "facebook" | "manual" | "field") {
    track(provider === "meta_business" ? "onboarding.meta_requested" : "onboarding.gbp_requested", { provider });
    if (action === "facebook") {
      await signIn("facebook", { callbackUrl: "/onboarding" });
      return;
    }
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connections: [{ provider }] }),
    }).catch(() => {});
    setConnected((c) => ({ ...c, [provider]: true }));
  }

  async function finish() {
    setBusy(true);
    track("onboarding.completed", { connections: Object.keys(connected).length });
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    }).catch(() => {});
    setBusy(false);
    setDone(true);
    router.push("/dashboard");
  }

  return (
    <div className="shell max-w-[820px]">
      <p className="t-mono blue mb-4">Onboarding · etapa {step + 1} de 2</p>
      <h1 className="t-h1 mb-4">
        Hola {userName.split(" ")[0]}. Vamos a <span className="serif-accent blue">ver</span> tu negocio.
      </h1>
      <p className="t-body mb-12 max-w-[58ch] opacity-65">
        Dos pantallas. La primera nos dice qué medimos; la segunda nos da acceso de lectura
        a los activos donde vive la señal. Nada se publica ni se modifica sin tu aprobación.
      </p>

      {/* progress */}
      <div className="mb-12 flex gap-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="h-[3px] flex-1"
            style={{ background: i <= step ? brand.color.blue : "rgba(255,245,239,0.12)" }} />
        ))}
      </div>

      {/* ---------------- STEP 1 ---------------- */}
      {step === 0 && (
        <form
          data-track-form="onboarding-profile"
          onSubmit={(e) => { e.preventDefault(); void saveProfile(); }}
          className="flex flex-col gap-6"
        >
          <Field label="Empresa" name="company">
            <input name="company" value={form.company} onChange={(e) => set("company", e.target.value)}
              placeholder="AISOLVES S.L." style={inputStyle} required />
          </Field>

          <Field label="Web actual" name="website" hint="La analizamos para estimar tu pérdida de señal.">
            <input name="website" type="url" value={form.website} onChange={(e) => set("website", e.target.value)}
              placeholder="https://tuempresa.com" style={inputStyle} required />
          </Field>

          <Field label="Sector" name="industry">
            <select name="industry" value={form.industry} onChange={(e) => set("industry", e.target.value)}
              style={inputStyle} required>
              <option value="">Selecciona…</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>

          <Field label="Inversión publicitaria mensual" name="monthlyBudget">
            <div className="flex flex-wrap gap-2">
              {BUDGETS.map((b) => (
                <button key={b.v} type="button" onClick={() => set("monthlyBudget", b.v)}
                  data-track-cta={`budget-${b.v}`}
                  className="chip"
                  style={{
                    cursor: "pointer",
                    borderColor: form.monthlyBudget === b.v ? brand.color.blue : "var(--line)",
                    color: form.monthlyBudget === b.v ? brand.color.cream : undefined,
                    background: form.monthlyBudget === b.v ? "rgba(0,40,255,0.12)" : "transparent",
                    fontFamily: "inherit",
                  }}>
                  {b.l}
                </button>
              ))}
            </div>
            <input type="hidden" name="monthlyBudget" value={form.monthlyBudget} />
          </Field>

          <Field label="WhatsApp" name="whatsapp" hint="Es el canal por el que operamos. No hay soporte por email.">
            <input name="whatsapp" type="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)}
              placeholder="+34 600 000 000" style={inputStyle} required />
          </Field>

          <button type="submit" disabled={busy} data-track-cta="onboarding-next" className="btn btn-primary mt-4 self-start">
            <span>{busy ? "Guardando…" : "Continuar a accesos →"}</span>
          </button>
        </form>
      )}

      {/* ---------------- STEP 2 ---------------- */}
      {step === 1 && (
        <div>
          <div className="grid gap-px" style={{ background: "var(--line)" }}>
            {ASSETS.map((a) => {
              const isConnected = connected[a.provider] || (a.provider === "website" && Boolean(form.website));
              return (
                <div key={a.provider} data-track-block={`asset-${a.provider}`}
                  className="flex flex-wrap items-start justify-between gap-6 p-7"
                  style={{ background: brand.color.ink }}>
                  <div className="max-w-[46ch]">
                    <div className="mb-2 flex items-center gap-2.5">
                      <h3 className="t-h3">{a.name}</h3>
                      {isConnected && (
                        <span className="chip" style={{ borderColor: brand.color.blue, color: brand.color.cream }}>
                          Conectado
                        </span>
                      )}
                    </div>
                    <p className="t-body mb-2 opacity-65">{a.why}</p>
                    <p className="text-[12px] opacity-40">{a.never}</p>
                  </div>
                  {a.provider === "website" ? (
                    <span className="t-mono self-center opacity-50">{form.website || "—"}</span>
                  ) : (
                    <button
                      onClick={() => void requestAsset(a.provider, a.action)}
                      disabled={isConnected}
                      data-track-cta={`connect-${a.provider}`}
                      className={isConnected ? "btn btn-ghost" : "btn btn-primary"}
                      style={{ opacity: isConnected ? 0.5 : 1 }}
                    >
                      <span>{isConnected ? "Listo" : "Conceder acceso"}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="card mt-8 p-6">
            <p className="t-mono blue mb-3">Nota sobre permisos</p>
            <p className="t-body opacity-65">
              Los permisos de <code style={{ fontFamily: "ui-monospace, monospace" }}>business_management</code> de Meta y
              de Google Business Profile requieren revisión de la app en cada plataforma. Mientras esa revisión
              está en curso, registramos la solicitud aquí y completamos el acceso por invitación de partner
              desde tu propio Business Manager — que es como opera cualquier agencia seria: tú conservas la
              propiedad de los activos.
            </p>
          </div>

          <div className="mt-8 flex gap-3">
            <button onClick={() => setStep(0)} className="btn btn-ghost"><span>← Atrás</span></button>
            <button onClick={() => void finish()} disabled={busy} data-track-cta="onboarding-finish" className="btn btn-primary">
              <span>{busy ? "Activando…" : done ? "Ir al dashboard →" : "Finalizar y ver mi dashboard →"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, name, hint, children }: { label: string; name: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="t-mono mb-2 block opacity-50">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] opacity-40">{hint}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,245,239,0.05)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  color: "#FFF5EF",
  padding: "0.8rem 0.95rem",
  fontSize: "0.9rem",
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
};
