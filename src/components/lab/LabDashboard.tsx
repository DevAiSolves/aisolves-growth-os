"use client";

import { useState, useTransition } from "react";
import type { LabReport } from "@/lib/analytics/movements";
import type { Light } from "@/lib/analytics/benchmarks";
import { Bar, BlockBar, LightBadge, ScoreRing, LIGHT_GLYPH, LIGHT_HEX } from "./primitives";

const ms = (n: number | null) => n === null ? "—" : n < 1000 ? `${Math.round(n)}ms` : `${(n / 1000).toFixed(1)}s`;
const pctS = (n: number | null) => n === null ? "—" : `${n.toFixed(1)}%`;
const intS = (n: number | null) => n === null ? "—" : Math.round(n).toLocaleString("es-ES");

const SEGMENTS = [
  { key: "all", label: "Todo" },
  { key: "paid", label: "Paid" },
  { key: "organic", label: "Organic" },
  { key: "mobile", label: "Mobile" },
  { key: "desktop", label: "Desktop" },
];

export function LabDashboard({
  segments, days,
}: { segments: Record<string, LabReport>; days: number }) {
  const [active, setActive] = useState("all");
  const [, startTransition] = useTransition();
  const r = segments[active] ?? segments.all;

  /** View Transitions make the numbers morph between segments instead of
   *  snapping, which is what keeps a paid-vs-organic comparison readable. */
  function switchSegment(key: string) {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doc.startViewTransition(() => { startTransition(() => setActive(key)); });
    } else setActive(key);
  }

  if (!r) return <p className="t-body">Sin datos.</p>;

  const scoreLight: Light =
    r.score.score === null ? "black"
    : r.score.score >= 70 ? "green"
    : r.score.score >= 40 ? "yellow" : "red";

  return (
    <div>
      {/* ================= HEADER ================= */}
      <div className="lab-scan" style={{ ["--scan-h" as string]: "230px" }}>
        <div style={{ display: "grid", gap: 28, gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center" }}>
          <div>
            <p className="t-mono blue" style={{ marginBottom: 10 }}>TRAFFIC LAB</p>
            <h1 className="t-h1" style={{ fontSize: "clamp(1.8rem,3.6vw,2.8rem)", marginBottom: 14 }}>
              Diagnóstico de tráfico y calidad de señal
            </h1>
            <div className="t-mono" style={{ opacity: 0.55, display: "flex", flexWrap: "wrap", gap: 14 }}>
              <span>aisolves.pro</span>
              <span>· últimos {days}d</span>
              <span>· fuente: {r.meta.source}</span>
              <span>· segmento: {r.meta.segment}</span>
            </div>
            <div style={{ display: "flex", gap: 26, marginTop: 20, flexWrap: "wrap" }}>
              <Kpi label="UU entrada" value={intS(r.meta.uuEntrada)} />
              <Kpi label="Sesiones" value={intS(r.meta.sessions)} />
              <Kpi label="Sesiones/UU" value={r.meta.sessionsPerUu?.toFixed(2) ?? "—"} />
              <Kpi label="Eventos" value={intS(r.meta.totalEvents)} />
            </div>
          </div>
          <ScoreRing score={r.score.score} light={scoreLight} confidence={r.score.confidence} />
        </div>

        {/* score formula transparency */}
        <details style={{ marginTop: 20 }}>
          <summary className="t-mono" style={{ cursor: "pointer", opacity: 0.5 }}>
            Fórmula del score · cobertura {(r.score.coverage * 100).toFixed(0)}%
          </summary>
          <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
            {r.score.contributions.map((c) => (
              <div key={c.label} style={{ display: "grid", gridTemplateColumns: "170px 60px 1fr 70px", gap: 12, alignItems: "center", fontSize: 12 }}>
                <span style={{ opacity: 0.7 }}>{c.label}</span>
                <span className="t-mono" style={{ opacity: 0.45 }}>×{c.weight.toFixed(2)}</span>
                <Bar ratio={c.value} light={c.value === null ? "black" : c.value >= 0.7 ? "green" : c.value >= 0.4 ? "yellow" : "red"} />
                <span className="t-mono" style={{ textAlign: "right", opacity: 0.6 }}>
                  {c.points === null ? "sin medir" : `+${c.points}`}
                </span>
              </div>
            ))}
            {r.score.missing.length > 0 && (
              <p style={{ fontSize: 11.5, opacity: 0.45, marginTop: 6 }}>
                Excluidos del cálculo y renormalizados: {r.score.missing.join(", ")}. El score no los
                cuenta como cero — un dato que no existe no es un dato que valga 0.
              </p>
            )}
          </div>
        </details>
      </div>

      {/* ================= SEGMENT TABS ================= */}
      <div style={{ display: "flex", gap: 8, margin: "32px 0 22px", flexWrap: "wrap" }}>
        {SEGMENTS.filter((s) => segments[s.key]).map((s) => (
          <button
            key={s.key}
            onClick={() => switchSegment(s.key)}
            data-track-cta={`lab-seg-${s.key}`}
            className="chip"
            style={{
              cursor: "pointer", fontFamily: "inherit",
              borderColor: active === s.key ? "#0028FF" : "var(--line)",
              background: active === s.key ? "rgba(0,40,255,0.14)" : "transparent",
              color: active === s.key ? "#FFF5EF" : undefined,
            }}
          >
            {s.label}
            <span style={{ opacity: 0.5, marginLeft: 6 }}>
              {intS(segments[s.key].meta.uuEntrada)}
            </span>
          </button>
        ))}
      </div>

      <div className="vt-panel">
        {/* ================= 1. 20 MOVEMENTS ================= */}
        <Section n="1" title="Los 20 movimientos"
        sub="% SIEMPRE sobre UU entrada. La BARRA mide cumplimiento del benchmark propio de cada fila (no el % sobre UU): por eso una fila con 1,2% de UU puede ir llena y verde si su tasa sobre su propio denominador supera el objetivo. ⚫ = sin medición, nunca cero.">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 980 }}>
              <thead>
                <tr className="t-mono" style={{ opacity: 0.45, textAlign: "left" }}>
                  {["Movimiento", "UU", "% UU", "Events", "Ev/UU", "◉", "Barra (vs benchmark)", "Timing", "Nota"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", fontWeight: 400, borderBottom: "1px solid var(--lab-grid)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.movements.map((m) => (
                  <tr key={m.key} className="lab-row" style={{ borderBottom: "1px solid var(--lab-grid)" }}>
                    <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>{m.label}</td>
                    <td style={{ padding: "9px 10px", fontVariantNumeric: "tabular-nums" }}>{intS(m.uu)}</td>
                    <td style={{ padding: "9px 10px", fontVariantNumeric: "tabular-nums", color: m.pct === null ? "#4A4744" : undefined }}>{pctS(m.pct)}</td>
                    <td style={{ padding: "9px 10px", fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>{intS(m.events)}</td>
                    <td style={{ padding: "9px 10px", fontVariantNumeric: "tabular-nums", opacity: 0.7 }}>{m.eventsPerUu ?? "—"}</td>
                    <td style={{ padding: "9px 10px" }} title={m.verdict.reason}>
                      <LightBadge light={m.verdict.light} reason={m.verdict.reason} />
                    </td>
                    <td style={{ padding: "9px 10px", minWidth: 150 }}>
                      <Bar ratio={m.ratio} light={m.verdict.light} />
                    </td>
                    <td className="t-mono" style={{ padding: "9px 10px", opacity: 0.6, whiteSpace: "nowrap" }}>{ms(m.medianMs)}</td>
                    <td style={{ padding: "9px 10px", opacity: 0.5, fontSize: 11.5 }}>{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* monospaced fallback view, exactly as the brief specifies */}
          <details style={{ marginTop: 16 }}>
            <summary className="t-mono" style={{ cursor: "pointer", opacity: 0.45 }}>Vista monoespaciada (copiable)</summary>
            <pre style={{ fontSize: 11, lineHeight: 1.7, overflowX: "auto", opacity: 0.8 }}>
              {r.movements.map((m) => (
                <div key={m.key}>
                  {LIGHT_GLYPH[m.verdict.light]} {m.label.padEnd(24).slice(0, 24)} {String(intS(m.uu)).padStart(7)} {pctS(m.pct).padStart(7)} <BlockBar ratio={m.ratio} />
                </div>
              ))}
            </pre>
          </details>
        </Section>

        {/* ================= 2. TIMING ================= */}
        <Section n="2" title="Reparto de supervivencia" sub="Sobre tiempo ACTIVO. Una pestaña de fondo nunca suma.">
          {r.timing.length === 0 ? <Empty /> : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${r.timing.length},1fr)`, gap: 10, alignItems: "end", height: 180 }}>
              {r.timing.map((t, i) => {
                const max = Math.max(...r.timing.map((x) => x.pct), 1);
                return (
                  <div key={t.label} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", gap: 8 }}>
                    <span className="t-mono" style={{ opacity: 0.6, textAlign: "center" }}>{t.pct.toFixed(1)}%</span>
                    <div className="histo__col" style={{
                      ["--i" as string]: i,
                      height: `${Math.max(3, (t.pct / max) * 100)}%`,
                      background: i < 2 ? "var(--lab-red)" : i < 4 ? "var(--lab-yellow)" : "var(--lab-green)",
                      borderRadius: 2,
                    }} />
                    <span className="t-mono" style={{ opacity: 0.45, textAlign: "center", fontSize: 9.5 }}>{t.label}</span>
                    <span className="t-mono" style={{ opacity: 0.3, textAlign: "center", fontSize: 9.5 }}>{t.uu} UU</span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ================= 3. SECTIONS ================= */}
        <Section n="3" title="Semáforo por sección" sub="De arriba abajo, con la fricción medida y el arreglo concreto.">
          {r.sections.length === 0 ? <Empty /> : (
            <div style={{ display: "grid", gap: 1, background: "var(--lab-grid)" }}>
              {r.sections.map((s) => (
                <div key={s.id} className="lab-row" style={{
                  display: "grid", gridTemplateColumns: "110px 70px 1fr 100px 1fr 1fr", gap: 14,
                  padding: "12px 14px", background: "#000", alignItems: "center", fontSize: 12.5,
                }}>
                  <span>{s.label}</span>
                  <span className="t-mono" style={{ color: LIGHT_HEX[s.light] }}>{pctS(s.pct)}</span>
                  <Bar ratio={s.pct === null ? null : s.pct / 100} light={s.light} />
                  <span className="t-mono" style={{ opacity: 0.55 }}>{ms(s.medianDwellMs)}</span>
                  <span style={{ opacity: 0.5, fontSize: 11.5 }}>{s.friction}</span>
                  <span className="blue" style={{ fontSize: 11.5 }}>{s.fix}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ================= 4. TIMELINE ================= */}
        <Section n="4" title="Timeline del UU mediano" sub="Qué ve, qué hace, qué evento debería dispararse — y si hoy se dispara.">
          {r.timeline.length === 0 ? <Empty /> : (
            <div style={{ display: "grid", gap: 1, background: "var(--lab-grid)" }}>
              {r.timeline.map((t, i) => (
                <div key={i} className="lab-row" style={{
                  display: "grid", gridTemplateColumns: "70px 1fr 1fr 1.2fr 90px", gap: 14,
                  padding: "11px 14px", background: "#000", alignItems: "center", fontSize: 12.5,
                }}>
                  <span className="t-mono blue">{t.t}</span>
                  <span style={{ opacity: 0.75 }}>{t.sees}</span>
                  <span style={{ opacity: 0.55 }}>{t.does}</span>
                  <span className="t-mono" style={{ opacity: 0.6 }}>{t.event}</span>
                  <span className="light" data-light={t.firing ? "green" : "red"} style={{ fontSize: 11 }}>
                    <span className="light__dot" />{t.firing ? "dispara" : "NO dispara"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ================= 5. META SIGNAL ================= */}
        <Section n="5" title="Señal a Meta" sub="Qué se puede optimizar y qué es solo reporting. Confundirlos es lo que sube el CPA.">
          <div style={{ display: "grid", gap: 22, gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
            <Panel title="Optimizable" tone="green">
              {r.metaSignal.optimize.length === 0 ? <Empty /> : r.metaSignal.optimize.map((o) => (
                <Line key={o.name} left={o.meta} right={`${intS(o.fires)} fires`}
                      light={o.fires === 0 ? "red" : "green"} sub={o.name} />
              ))}
            </Panel>
            <Panel title="Solo reporting" tone="yellow">
              {r.metaSignal.reporting.slice(0, 10).map((o) => (
                <Line key={o.name} left={o.meta} right={`${intS(o.fires)} fires`}
                      light={o.fires === 0 ? "black" : "yellow"} sub={o.name} />
              ))}
              <p style={{ fontSize: 11, opacity: 0.4, marginTop: 8 }}>
                Nunca pongas un objetivo de campaña sobre estos: optimizar contra un scroll
                enseña al modelo a comprar scrollers baratos.
              </p>
            </Panel>
            <Panel title="EMQ (estimado)" tone={r.emq.benchmark.light}>
              <div style={{ fontSize: "2rem", letterSpacing: "-0.04em", marginBottom: 6 }}>
                {r.emq.score}<span style={{ opacity: 0.4, fontSize: "1rem" }}>/10</span>
              </div>
              <p style={{ fontSize: 11, opacity: 0.5, marginBottom: 10 }}>
                ESTIMADO — techo según las claves que transmitimos. El EMQ real lo calcula
                Meta y siempre es ≤ éste. Contrástalo en Events Manager.
              </p>
              {r.emq.biggestGap && (
                <p style={{ fontSize: 11.5 }}>
                  Mayor hueco: <strong className="blue">{r.emq.biggestGap}</strong>
                  {" "}· recuperables ~{r.emq.recoverable} pts
                </p>
              )}
            </Panel>
            <Panel title="Pixel ↔ CAPI" tone={r.dedup.benchmark.light}>
              <div style={{ fontSize: "2rem", letterSpacing: "-0.04em", marginBottom: 6 }}>
                {r.dedup.matchRate === null ? "—" : `${r.dedup.matchRate}%`}
              </div>
              <Line left="Ambos (dedup OK)" right={intS(r.dedup.matched)} light="green" />
              <Line left="Solo CAPI (recuperado)" right={intS(r.dedup.capiOnly)} light="yellow" />
              <Line left="Solo Pixel (gap CAPI)" right={intS(r.dedup.pixelOnly)} light={r.dedup.pixelOnly ? "red" : "green"} />
              <p style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>{r.dedup.verdict}</p>
            </Panel>
          </div>

          {r.metaSignal.gaps.length > 0 && (
            <div style={{ marginTop: 18, padding: 16, border: "1px solid var(--lab-red)", borderRadius: 8 }}>
              <p className="t-mono" style={{ color: "var(--lab-red)", marginBottom: 8 }}>Gaps de señal</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, opacity: 0.75 }}>
                {r.metaSignal.gaps.map((g) => <li key={g} style={{ marginBottom: 4 }}>{g}</li>)}
              </ul>
            </div>
          )}
        </Section>

        {/* ================= 6. DATA GAPS ================= */}
        {r.dataGaps.length > 0 && (
          <Section n="6" title="Datos que faltan" sub="Declarados, no rellenados. Un hueco admitido vale más que un número inventado.">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, opacity: 0.7 }}>
              {r.dataGaps.map((g) => <li key={g} style={{ marginBottom: 6 }}>⚫ {g}</li>)}
            </ul>
          </Section>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

function Section({ n, title, sub, children }: { n: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 48 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <span className="t-mono blue">{n}</span>
        <h2 className="t-h3" style={{ margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: 12.5, opacity: 0.45, margin: "0 0 18px 26px" }}>{sub}</p>
      {children}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="t-mono" style={{ opacity: 0.45, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: "1.35rem", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

function Panel({ title, tone, children }: { title: string; tone: Light; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${LIGHT_HEX[tone]}33`, borderRadius: 8, padding: 16 }}>
      <p className="t-mono" style={{ opacity: 0.5, marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  );
}

function Line({ left, right, light, sub }: { left: string; right: string; light: Light; sub?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "5px 0", fontSize: 12.5 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <LightBadge light={light} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {left}{sub && <span className="t-mono" style={{ opacity: 0.35, marginLeft: 6 }}>{sub}</span>}
        </span>
      </span>
      <span className="t-mono" style={{ opacity: 0.6, flex: "none" }}>{right}</span>
    </div>
  );
}

function Empty() {
  return <p style={{ fontSize: 12.5, opacity: 0.4 }}>⚫ Sin medición en este segmento.</p>;
}
