"use client";

import { Section, SectionLabel } from "@/components/site/Section";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { Reveal } from "@/components/motion/Reveal";

const pillars = [
  {
    id: "capture",
    step: "Captura",
    title: "Absorción de metadata",
    body: "Cada sección, bloque y campo emite eventos estructurados: profundidad, tiempo real de atención, hover sostenido, retrocesos de lectura, dudas en formularios, rage clicks e intención de salida.",
    items: [
      "Observers por sección y por bloque",
      "Metadata de formularios sin leer valores",
      "Velocidad de scroll y relectura",
      "Fricción: rage / dead click, exit intent",
    ],
  },
  {
    id: "score",
    step: "Puntuación",
    title: "Lead scoring conductual",
    body: "Un motor de scoring en cuatro dimensiones —intención, engagement, encaje e identidad— convierte el ruido en un número de 0 a 100 y en una banda de temperatura accionable.",
    items: [
      "Intención 0-40 · Engagement 0-25",
      "Fit 0-20 · Identidad 0-15",
      "Bandas COLD → WARM → HOT → MQL → SQL",
      "Histórico de score con causa de cada salto",
    ],
  },
  {
    id: "activate",
    step: "Activación",
    title: "Píxeles y CAPI server-side",
    body: "El mismo event_id viaja por el navegador y por el servidor. Meta deduplica y se queda con la señal de mayor calidad. Recuperas los eventos que los bloqueadores borran.",
    items: [
      "Meta Pixel + Conversions API",
      "Google Consent Mode v2 + GA4 MP",
      "TikTok Events API · LinkedIn",
      "PII hasheada SHA-256 en origen",
    ],
  },
];

export function Engine() {
  return (
    <Section id="engine" order={3} theme="light" className="py-24 lg:py-32">
      <SectionLabel index="02">El sistema</SectionLabel>
      <SplitReveal as="h2" className="t-h1 mt-6 max-w-[17ch]">
        Tres capas. Un solo dato: el comportamiento.
      </SplitReveal>

      <div className="mt-16 grid gap-px lg:grid-cols-3" style={{ background: "var(--line)" }}>
        {pillars.map((p, i) => (
          <Reveal
            key={p.id}
            delay={i * 0.08}
            className="flex flex-col p-8"
          >
            <div data-track-block={`engine-${p.id}`}>
              <p className="t-mono blue mb-5">0{i + 1} / {p.step}</p>
              <h3 className="t-h2 mb-4" style={{ fontSize: "clamp(1.35rem,2.1vw,1.85rem)" }}>{p.title}</h3>
              <p className="t-body mb-6 opacity-65">{p.body}</p>
              <ul className="flex list-none flex-col gap-2.5 p-0">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2.5 text-[13px] opacity-75">
                    <span className="blue mt-[2px] shrink-0">✦</span>{it}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-14" as="div">
        <div className="card p-8">
          <p className="t-mono blue mb-4">Por qué importa la deduplicación</p>
          <p className="t-body max-w-[80ch] opacity-70">
            Enviar el evento solo por navegador pierde entre un 20 % y un 40 % de las conversiones.
            Enviarlo por los dos canales sin un <code style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.9em" }}>event_id</code> compartido
            las duplica y envenena el modelo de puja. La implementación correcta —la que instalamos—
            envía siempre el par con el mismo identificador. Es el detalle que separa un ROAS
            reportado de un ROAS real.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
