"use client";

import { Section, SectionLabel } from "@/components/site/Section";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { brand } from "@/lib/brand";

export const PACKAGES = [
  {
    slug: "signal",
    name: "Signal",
    tagline: "Empieza a ver lo que ya está pasando.",
    priceFrom: 1200,
    for: "Negocios con tráfico que no saben qué ocurre después del clic.",
    features: [
      "Auditoría completa de pérdida de señal",
      "Taxonomía de eventos unificada",
      "Meta Pixel + Conversions API deduplicados",
      "Google Consent Mode v2 + GA4 server-side",
      "Motor de lead scoring conductual",
      "Dashboard de comportamiento en tiempo real",
      "Informe mensual de calidad de datos",
    ],
  },
  {
    slug: "engine",
    name: "Engine",
    tagline: "El sistema completo, funcionando solo.",
    priceFrom: 2900,
    highlight: true,
    for: "Equipos que ya invierten en ads y necesitan que el dato mande.",
    features: [
      "Todo lo incluido en Signal",
      "Gestión de Meta Ads y Google Ads",
      "Retargeting por comportamiento y secuencias progresivas",
      "Contenido orgánico: reels, carruseles e historias",
      "WhatsApp Business API con detección de intención",
      "Nutrición de preventa automatizada multicanal",
      "Enrutamiento automático de leads por temperatura",
      "SEO técnico + AIO / GEO",
    ],
  },
  {
    slug: "compound",
    name: "Compound",
    tagline: "Crecimiento que se acelera con el tiempo.",
    priceFrom: 5500,
    for: "Negocios de ticket alto listos para escalar con constraint identificado.",
    features: [
      "Todo lo incluido en Engine",
      "Onboarding de alta activación (48-72 h)",
      "Arquitectura completa de las 6 etapas del negocio",
      "Estrategia de viralidad con activos combinados",
      "Experimentación continua (A/B con hipótesis y lectura)",
      "Modelado de atribución multi-touch",
      "Sesión estratégica semanal con CEO y CMO",
      "SLA de contacto < 15 min para leads SQL",
    ],
  },
];

export function Packages() {
  return (
    <Section id="packages" order={6} theme="dark" className="py-24 lg:py-32">
      <SectionLabel index="05">Paquetes</SectionLabel>
      <SplitReveal as="h2" className="t-h1 mt-6 max-w-[18ch]">
        Precios que dependen del sistema, no de las horas.
      </SplitReveal>
      <p className="t-body mt-6 max-w-[56ch] opacity-65">
        Retainer mensual, sin permanencia. Si el sistema no mueve throughput, no
        tiene sentido que sigas pagándolo.
      </p>

      <div className="mt-16 grid gap-px lg:grid-cols-3" style={{ background: "var(--line)" }}>
        {PACKAGES.map((p) => (
          <article
            key={p.slug}
            data-track-block={`package-${p.slug}`}
            className="flex flex-col p-8"
            style={{
              background: p.highlight ? "rgba(0,40,255,0.07)" : brand.color.ink,
              borderTop: p.highlight ? `2px solid ${brand.color.blue}` : "2px solid transparent",
            }}
          >
            {p.highlight && <p className="t-mono blue mb-4">Más contratado</p>}
            <h3 className="t-h2 mb-2" style={{ fontSize: "clamp(1.5rem,2.4vw,2rem)" }}>{p.name}</h3>
            <p className="t-body mb-6 opacity-65">{p.tagline}</p>

            <div className="mb-6">
              <span className="t-mono opacity-45">Desde</span>
              <p className="t-display" style={{ fontSize: "clamp(2.2rem,3.6vw,3rem)", lineHeight: 1 }}>
                {p.priceFrom.toLocaleString("es-ES")}<span className="blue">€</span>
                <span className="t-mono ml-2 opacity-45">/mes</span>
              </p>
            </div>

            <p className="mb-6 text-[12.5px] leading-relaxed opacity-55">{p.for}</p>

            <ul className="mb-8 flex flex-1 list-none flex-col gap-2.5 p-0">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] opacity-80">
                  <span className="blue mt-[2px] shrink-0">✦</span>{f}
                </li>
              ))}
            </ul>

            <a
              href={`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(`Hola, me interesa el paquete ${p.name}.`)}`}
              target="_blank" rel="noopener noreferrer"
              data-track-cta={`package-${p.slug}`}
              className={p.highlight ? "btn btn-primary" : "btn btn-ghost"}
              style={{ justifyContent: "center" }}
            >
              <span>Solicitar diagnóstico</span>
            </a>
          </article>
        ))}
      </div>
    </Section>
  );
}
