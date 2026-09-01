"use client";

import { Section, SectionLabel } from "@/components/site/Section";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { Reveal } from "@/components/motion/Reveal";

const phases = [
  {
    weeks: "Semanas 1 – 3",
    name: "Instrumentación",
    goal: "Que el negocio empiece a ver.",
    steps: [
      { t: "Auditoría de pérdida de señal", d: "Medimos cuántas conversiones se están perdiendo hoy entre navegador y servidor." },
      { t: "Taxonomía de eventos", d: "Un naming único para Meta, Google, TikTok, email y WhatsApp. Sin este paso nada es comparable." },
      { t: "Data layer y CAPI", d: "Pixel + Conversions API deduplicados, Consent Mode v2 y Enhanced Conversions." },
      { t: "Modelo de scoring", d: "Definimos qué comportamiento vale cuánto en tu negocio concreto." },
    ],
  },
  {
    weeks: "Semanas 4 – 7",
    name: "Ignición",
    goal: "Convertir datos en conversaciones.",
    steps: [
      { t: "Activos de viralidad", d: "Carruseles, reels e historias construidos sobre las objeciones que revelan los datos." },
      { t: "Campañas de intención", d: "Meta y Google alimentados con audiencias conductuales, no demográficas." },
      { t: "Nutrición comportamental", d: "Secuencias disparadas por evento: revisita de precio, abandono, scroll profundo." },
      { t: "WhatsApp como canal primario", d: "Plantillas, botones interactivos y detección de intención con handover a humano." },
    ],
  },
  {
    weeks: "Semanas 8 – 12",
    name: "Escala",
    goal: "Que el sistema decida solo.",
    steps: [
      { t: "Enrutamiento automático", d: "SQL a llamada en menos de 15 minutos. COLD a audiencia de awareness. Sin criterio humano." },
      { t: "Retargeting secuencial", d: "Mensaje progresivo según etapa del funnel y frequency capping por temperatura." },
      { t: "Onboarding de alta activación", d: "Las primeras 48-72 h automatizadas y medidas. Time-to-value como KPI." },
      { t: "Optimización por throughput", d: "Identificamos el constraint de cada mes y atacamos solo ese." },
    ],
  },
];

export function Method() {
  return (
    <Section id="method" order={5} theme="light" className="py-24 lg:py-32">
      <SectionLabel index="04">Método</SectionLabel>
      <SplitReveal as="h2" className="t-h1 mt-6 max-w-[18ch]">
        90 días para que el sistema decida por ti.
      </SplitReveal>

      <div className="mt-16 flex flex-col">
        {phases.map((p, i) => (
          <Reveal key={p.name} delay={i * 0.06} className="hairline-t py-10">
            <div data-track-block={`method-${i}`} className="grid gap-8 lg:grid-cols-[240px_1fr]">
              <div>
                <p className="t-mono blue mb-2">{p.weeks}</p>
                <h3 className="t-h2" style={{ fontSize: "clamp(1.5rem,2.6vw,2.2rem)" }}>{p.name}</h3>
                <p className="t-body mt-2 opacity-60">{p.goal}</p>
              </div>
              <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
                {p.steps.map((s) => (
                  <div key={s.t}>
                    <h4 className="t-h3 mb-1.5" style={{ fontSize: "0.95rem" }}>{s.t}</h4>
                    <p className="text-[13px] leading-relaxed opacity-60">{s.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
