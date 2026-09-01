"use client";

import { Section, SectionLabel } from "@/components/site/Section";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { Reveal } from "@/components/motion/Reveal";

const columns = [
  {
    id: "visibility",
    label: "Visibilidad",
    title: "SEO · SEM · AIO · GEO",
    items: [
      { t: "SEO técnico y de contenido", d: "Arquitectura, Core Web Vitals, schema y clusters temáticos que sostienen posiciones." },
      { t: "SEM de intención", d: "Search y Performance Max con Enhanced Conversions y exclusiones inteligentes." },
      { t: "AIO — AI Optimization", d: "Contenido estructurado para ser citado por ChatGPT, Claude, Gemini y Perplexity." },
      { t: "GEO — Generative Engine Optimization", d: "Entidades, autoridad y datos verificables para aparecer en respuestas generativas." },
    ],
  },
  {
    id: "creative",
    label: "Viralidad",
    title: "Activos que se comparten",
    items: [
      { t: "Combinaciones exclusivas", d: "Carruseles, historias y reels diseñados como un solo sistema narrativo, no como piezas sueltas." },
      { t: "Storytelling de venta", d: "Estructura LIFE y arcos de conflicto-transformación aplicados a formato corto." },
      { t: "Community management avanzado", d: "Conversación orgánica que alimenta el funnel en lugar de decorarlo." },
      { t: "UGC y prueba social", d: "Activos de objeción diseñados desde las preguntas reales del embudo." },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    title: "Ads y remarketing",
    items: [
      { t: "Meta Ads + CAPI", d: "Pixel y Conversions API deduplicados, AEM configurado y catálogo diagnosticado." },
      { t: "Google Ads full-funnel", d: "PMax, Search, Demand Gen y Dynamic Remarketing sobre audiencias conductuales." },
      { t: "Retargeting por comportamiento", d: "Audiencias por profundidad de scroll, revisitas de precio y abandono de formulario." },
      { t: "Frequency capping y exclusiones", d: "Dejar de pagar por impactar a quien ya compró o nunca comprará." },
    ],
  },
  {
    id: "automation",
    label: "Automatización",
    title: "Funnels y embudos",
    items: [
      { t: "Arquitectura end-to-end", d: "Las 6 etapas: marketing, sales, closing, onboarding, delivery y post-venta." },
      { t: "Nutrición de preventa", d: "Secuencias comportamentales multicanal disparadas por eventos reales, no por tiempo." },
      { t: "WhatsApp Business API", d: "Webhooks, plantillas, botones interactivos, estados de mensaje y detección de intención." },
      { t: "Onboarding de alta activación", d: "Las primeras 48-72 horas, medidas y automatizadas. Es donde se decide el LTV." },
    ],
  },
];

export function Services() {
  return (
    <Section id="services" order={4} theme="dark" className="py-24 lg:py-32">
      <SectionLabel index="03">Servicios</SectionLabel>
      <SplitReveal as="h2" className="t-h1 mt-6 max-w-[20ch]">
        Cuatro frentes. Una sola <span className="serif-accent blue">arquitectura</span>.
      </SplitReveal>
      <Reveal as="p" className="t-body mt-6 max-w-[58ch] opacity-65">
        No contratas piezas sueltas. Contratas un sistema donde el contenido alimenta los
        datos, los datos alimentan los anuncios y los anuncios devuelven comportamiento
        que vuelve a alimentar el contenido.
      </Reveal>

      <div className="mt-16 grid gap-px md:grid-cols-2" style={{ background: "var(--line)" }}>
        {columns.map((col, ci) => (
          <div key={col.id} className="p-8" style={{ background: "var(--color-ink)" }}>
            <div className="mb-7 flex items-baseline gap-3">
              <span className="t-mono blue">0{ci + 1}</span>
              <div>
                <p className="t-mono opacity-45">{col.label}</p>
                <h3 className="t-h3 mt-1">{col.title}</h3>
              </div>
            </div>
            <div className="flex flex-col">
              {col.items.map((it, ii) => (
                <div
                  key={it.t}
                  data-track-block={`service-${col.id}-${ii}`}
                  className="hairline-t py-4 transition-colors"
                >
                  <h4 className="t-h3 mb-1.5" style={{ fontSize: "0.95rem" }}>{it.t}</h4>
                  <p className="text-[13px] leading-relaxed opacity-60">{it.d}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
