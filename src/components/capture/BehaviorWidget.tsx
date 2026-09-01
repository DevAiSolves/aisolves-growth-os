"use client";

import { useEffect, useRef, useState } from "react";
import { useTracking } from "@/components/providers/TrackingProvider";
import { brand } from "@/lib/brand";
import { tracker } from "@/lib/tracking/client";
import { submitLead, normalisePhone } from "@/lib/leads";

/**
 * THE END-OF-SCROLL WIDGET
 *
 * The offer: leave a name and a WhatsApp number, and we show you the
 * behavioural profile we just built about you — score, breakdown, the sections
 * that held your attention, the signals that fired.
 *
 * This converts because it is not a lead magnet, it is a demonstration. The
 * prospect experiences the product on themselves before they ever get a call.
 * The same payload is what lands in our dashboard, so the sales conversation
 * starts from shared evidence.
 */

const TRIGGER_PCT = 85;
const DISMISSED_KEY = "ais_widget_dismissed";
const LEAD_KEY = "ais_lead";

type Stage = "hidden" | "teaser" | "form" | "report";

interface Report {
  score: number;
  temperature: string;
  breakdown: { intent: number; engage: number; fit: number; identity: number };
  signals: string[];
  sectionDwell: Record<string, number>;
  topSection: string;
  activeMs: number;
  maxScroll: number;
  totalEvents: number;
  sessions: number;
}

const SECTION_LABELS: Record<string, string> = {
  hero: "Apertura", problem: "El problema", engine: "El sistema",
  services: "Servicios", method: "Método", packages: "Paquetes",
  proof: "Resultados", team: "Equipo", faq: "Preguntas", contact: "Contacto",
};

const TEMP_COPY: Record<string, { label: string; note: string }> = {
  COLD:  { label: "Explorador",  note: "Estás escaneando. Todavía no hay intención medible." },
  WARM:  { label: "Interesado",  note: "Hay atención real, pero aún no una decisión." },
  HOT:   { label: "En decisión", note: "Tu patrón coincide con el de alguien comparando proveedores." },
  MQL:   { label: "Cualificado", note: "Comportamiento de compra. Un humano debería escribirte hoy." },
  SQL:   { label: "Prioritario", note: "Estás en el 3% superior. Esto dispara una llamada directa." },
};

export function BehaviorWidget() {
  const { profile, anonId, track, consent } = useTracking();
  const [stage, setStage] = useState<Stage>("hidden");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const armed = useRef(false);

  // --- trigger at end of scroll -------------------------------------------
  useEffect(() => {
    if (localStorage.getItem(LEAD_KEY) || sessionStorage.getItem(DISMISSED_KEY)) return;
    const onScroll = () => {
      if (armed.current) return;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
      if (pct >= TRIGGER_PCT) {
        armed.current = true;
        setStage("teaser");
        track("lead.widget_shown", { triggerPct: Math.round(pct) });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [track]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Necesitamos tu nombre.");
    if (whatsapp.replace(/\D/g, "").length < 8) return setError("Un WhatsApp válido con prefijo de país.");

    setBusy(true);
    await tracker.flush(); // the server must hold every event before it scores

    const res = await submitLead({
      anonId,
      name: name.trim(),
      whatsapp: normalisePhone(whatsapp),
      source: "whatsapp_widget",
    });

    if (res.ok && res.leadId) {
      localStorage.setItem(LEAD_KEY, res.leadId);
      track("lead.whatsapp_submitted", {
        score: (res.report as { score?: number })?.score,
        temperature: (res.report as { temperature?: string })?.temperature,
      });
      setReport(res.report as unknown as Report);
      setStage("report");
      setBusy(false);
      return;
    }

    // A rejected payload is the visitor's problem to fix — say so.
    if (!res.queued) {
      setError("Revisa el nombre y el número e inténtalo de nuevo.");
      setBusy(false);
      return;
    }

    // Queued for retry. Show the report anyway: it is computed client-side with
    // the identical scoring function, so the number they see is the real one.
    if (profile) {
      setReport({
        score: profile.score, temperature: profile.temperature,
        breakdown: profile.breakdown, signals: profile.signals,
        sectionDwell: profile.sectionDwell,
        topSection: Object.entries(profile.sectionDwell).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
        activeMs: profile.activeMs, maxScroll: profile.maxScroll,
        totalEvents: profile.eventCount, sessions: profile.sessionCount,
      });
      setStage("report");
    } else {
      setError("Sin conexión. Lo reintentaremos automáticamente.");
    }
    setBusy(false);
  }

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setStage("hidden");
  }

  if (stage === "hidden") return null;

  const live = profile;
  const temp = report?.temperature ?? live?.temperature ?? "COLD";
  const copy = TEMP_COPY[temp] ?? TEMP_COPY.COLD;

  return (
    <div
      className="fixed bottom-4 right-4 z-[90] w-[calc(100%-2rem)] max-w-[380px]"
      style={{ animation: "ticker-in 0.5s var(--ease-out-brand)" }}
    >
      <div
        className="overflow-hidden"
        style={{
          background: brand.color.ink,
          border: `1px solid ${brand.color.blue}`,
          borderRadius: "var(--radius-md)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ height: 3, background: brand.color.blue }} />

        {/* ---------------- TEASER ---------------- */}
        {stage === "teaser" && (
          <button
            onClick={() => { setStage("form"); track("cta.click", { widget: "behavior_teaser" }); }}
            data-track-cta="widget-open"
            className="w-full p-5 text-left"
            style={{ background: "none", border: "none", cursor: "pointer", color: brand.color.cream, fontFamily: "inherit" }}
          >
            <div className="t-mono mb-3 flex items-center gap-2 opacity-60">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: brand.color.blue, animation: "pulse-ring 2s infinite" }} />
              Informe listo
            </div>
            <p className="t-h3 mb-1.5">
              Hemos registrado <span className="blue">{live?.eventCount ?? 0}</span> señales tuyas.
            </p>
            <p className="text-[12.5px] opacity-60">
              Deja tu nombre y WhatsApp y te mostramos el sistema leyéndote en tiempo real. →
            </p>
          </button>
        )}

        {/* ---------------- FORM ---------------- */}
        {stage === "form" && (
          <form onSubmit={submit} data-track-form="whatsapp-widget" className="p-5">
            <div className="t-mono mb-4 flex items-center justify-between opacity-60">
              <span>Tu informe conductual</span>
              <button type="button" onClick={dismiss} aria-label="Cerrar"
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 15 }}>×</button>
            </div>

            <p className="t-body mb-4" style={{ color: "rgba(255,245,239,0.7)" }}>
              Te enviamos por WhatsApp el mismo análisis que usamos internamente para decidir
              a quién llamamos primero.
            </p>

            <label className="t-mono mb-1.5 block opacity-50" htmlFor="w-name">Nombre</label>
            <input
              id="w-name" name="name" value={name} onChange={(e) => setName(e.target.value)}
              autoComplete="given-name" required minLength={2} placeholder="Javier"
              className="mb-3.5 w-full"
              style={inputStyle}
            />

            <label className="t-mono mb-1.5 block opacity-50" htmlFor="w-wa">WhatsApp</label>
            <input
              id="w-wa" name="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
              autoComplete="tel" inputMode="tel" required placeholder="+34 600 000 000"
              className="mb-4 w-full"
              style={inputStyle}
            />

            {error && <p className="mb-3 text-[12px]" style={{ color: "#FF6B5A" }}>{error}</p>}

            <button type="submit" disabled={busy} data-track-cta="widget-submit"
              className="btn btn-primary w-full" style={{ justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
              <span>{busy ? "Calculando…" : "Ver mi comportamiento en vivo"}</span>
            </button>

            <p className="mt-3 text-[10.5px] leading-relaxed" style={{ color: "rgba(255,245,239,0.35)" }}>
              Solo comportamiento. Nunca leemos lo que escribes en los campos —
              medimos cuánto tardas, si corriges y si dudas. {consent.granted ? "Consentimiento activo." : "Sin consentimiento personalizado activo."}
            </p>
          </form>
        )}

        {/* ---------------- REPORT ---------------- */}
        {stage === "report" && report && (
          <div className="max-h-[72vh] overflow-y-auto p-5 scrollbar-none">
            <div className="t-mono mb-4 flex items-center justify-between opacity-60">
              <span className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: brand.color.blue, animation: "pulse-ring 2s infinite" }} />
                En vivo · {name.split(" ")[0]}
              </span>
              <button onClick={dismiss} aria-label="Cerrar"
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 15 }}>×</button>
            </div>

            {/* score */}
            <div className="mb-5 flex items-end gap-3">
              <span className="t-display blue" style={{ fontSize: "3.6rem", lineHeight: 0.85 }}>
                {report.score}
              </span>
              <div className="pb-1.5">
                <p className="t-h3" style={{ color: brand.color.cream }}>{copy.label}</p>
                <p className="t-mono opacity-50">{temp} · {report.score}/100</p>
              </div>
            </div>
            <p className="t-body mb-5" style={{ color: "rgba(255,245,239,0.7)" }}>{copy.note}</p>

            {/* breakdown */}
            <div className="mb-5 flex flex-col gap-2.5">
              {([
                ["Intención", report.breakdown.intent, 40],
                ["Engagement", report.breakdown.engage, 25],
                ["Encaje (fit)", report.breakdown.fit, 20],
                ["Identidad", report.breakdown.identity, 15],
              ] as const).map(([label, val, max]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-[11px]" style={{ color: "rgba(255,245,239,0.6)" }}>
                    <span>{label}</span><span>{val}/{max}</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,245,239,0.1)", borderRadius: 2 }}>
                    <div style={{
                      height: "100%", width: `${(val / max) * 100}%`,
                      background: brand.color.blue, borderRadius: 2,
                      transition: "width 1s var(--ease-out-brand)",
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* metrics */}
            <div className="mb-5 grid grid-cols-2 gap-px" style={{ background: "var(--line)" }}>
              {[
                ["Atención real", `${Math.round(report.activeMs / 1000)}s`],
                ["Scroll máximo", `${report.maxScroll}%`],
                ["Señales", String(report.totalEvents)],
                ["Visitas", String(report.sessions)],
              ].map(([k, v]) => (
                <div key={k} className="p-3" style={{ background: brand.color.ink }}>
                  <p className="t-mono mb-1 opacity-45">{k}</p>
                  <p className="text-[17px]" style={{ color: brand.color.cream }}>{v}</p>
                </div>
              ))}
            </div>

            {/* attention map */}
            {Object.keys(report.sectionDwell).length > 0 && (
              <>
                <p className="t-mono mb-2.5 opacity-45">Dónde estuvo tu atención</p>
                <div className="mb-5 flex flex-col gap-1.5">
                  {Object.entries(report.sectionDwell)
                    .sort((a, b) => b[1] - a[1]).slice(0, 5)
                    .map(([id, ms], i, arr) => (
                      <div key={id} className="flex items-center gap-2.5">
                        <span className="w-[86px] shrink-0 text-[11.5px]" style={{ color: "rgba(255,245,239,0.6)" }}>
                          {SECTION_LABELS[id] ?? id}
                        </span>
                        <div className="h-[3px] flex-1" style={{ background: "rgba(255,245,239,0.1)", borderRadius: 2 }}>
                          <div style={{
                            height: "100%", width: `${Math.max(6, (ms / arr[0][1]) * 100)}%`,
                            background: i === 0 ? brand.color.blue : "rgba(255,245,239,0.35)", borderRadius: 2,
                          }} />
                        </div>
                        <span className="t-mono w-[36px] text-right opacity-45">{Math.round(ms / 1000)}s</span>
                      </div>
                    ))}
                </div>
              </>
            )}

            {/* signals */}
            {report.signals.length > 0 && (
              <>
                <p className="t-mono mb-2.5 opacity-45">Señales detectadas</p>
                <div className="mb-5 flex flex-wrap gap-1.5">
                  {report.signals.map((s) => (
                    <span key={s} className="chip" style={{ borderColor: brand.color.blue, color: brand.color.cream }}>
                      {s.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </>
            )}

            <a
              href={`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(
                `Hola, soy ${name}. Mi score conductual es ${report.score}/100 (${temp}). Quiero ver esto aplicado a mi negocio.`
              )}`}
              target="_blank" rel="noopener noreferrer"
              data-track-cta="widget-whatsapp"
              className="btn btn-primary w-full" style={{ justifyContent: "center" }}
            >
              <span>Continuar en WhatsApp →</span>
            </a>
            <p className="mt-3 text-[10.5px]" style={{ color: "rgba(255,245,239,0.35)" }}>
              Esto es exactamente lo que instalamos en tu web: cada visitante puntuado en
              tiempo real y enrutado al canal correcto.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,245,239,0.05)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  color: "#FFF5EF",
  padding: "0.7rem 0.85rem",
  fontSize: "0.875rem",
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
};
