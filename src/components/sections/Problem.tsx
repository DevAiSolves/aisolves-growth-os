"use client";

import { Section, SectionLabel } from "@/components/site/Section";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { Reveal } from "@/components/motion/Reveal";

const losses = [
  { n: "38%", t: "de tus conversiones nunca llegan a Meta", d: "ITP, ATT y bloqueadores borran el evento del navegador. El algoritmo optimiza con la mitad de la información y tu CPA sube sin que nadie sepa por qué." },
  { n: "0", t: "señales de intención de tu web", d: "Sabes cuánta gente entró. No sabes quién se quedó 40 segundos mirando el precio, volvió dos veces y no escribió." },
  { n: "72h", t: "de retraso en contactar al lead correcto", d: "Sin puntuación conductual, todos los leads entran iguales a la misma bandeja. El que iba a comprar se enfría esperando." },
];

export function Problem() {
  return (
    <Section id="problem" order={2} theme="dark" className="py-24 lg:py-32">
      <SectionLabel index="01">El constraint</SectionLabel>
      <SplitReveal as="h2" className="t-h1 mt-6 max-w-[19ch]">
        No tienes un problema de tráfico. Tienes un problema de ceguera.
      </SplitReveal>
      <Reveal className="t-body mt-6 max-w-[62ch] opacity-65" as="p">
        Casi todas las agencias optimizan la parte que se ve: el anuncio. El cuello de botella
        real está después del clic, en la capa que nadie mide — el comportamiento entre la
        visita y la decisión. Ahí es donde trabajamos.
      </Reveal>

      <div className="mt-16 grid gap-px md:grid-cols-3" style={{ background: "var(--line)" }}>
        {losses.map((l, i) => (
          <article
            key={l.t}
            data-track-block={`problem-${i}`}
            className="p-8"
            style={{ background: "var(--color-ink)" }}
          >
            <p className="t-display blue mb-4" style={{ fontSize: "clamp(2.6rem,4.4vw,3.6rem)" }}>{l.n}</p>
            <h3 className="t-h3 mb-3">{l.t}</h3>
            <p className="t-body opacity-60">{l.d}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
