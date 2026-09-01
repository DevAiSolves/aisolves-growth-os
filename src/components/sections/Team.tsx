"use client";

import { Section, SectionLabel } from "@/components/site/Section";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { Reveal } from "@/components/motion/Reveal";
import { brand } from "@/lib/brand";

export function Team() {
  return (
    <Section id="team" order={7} theme="light" className="py-24 lg:py-32">
      <SectionLabel index="06">Equipo</SectionLabel>
      <SplitReveal as="h2" className="t-h1 mt-6 max-w-[20ch]">
        Dos personas. Cero capas intermedias.
      </SplitReveal>
      <Reveal as="p" className="t-body mt-6 max-w-[58ch] opacity-65">
        No hay account manager traduciendo lo que dijo el estratega. Hablas
        directamente con quien construye el sistema y con quien escribe el contenido.
      </Reveal>

      <div className="mt-16 grid gap-px md:grid-cols-2" style={{ background: "var(--line)" }}>
        {brand.team.map((m, i) => (
          <Reveal key={m.name} delay={i * 0.08} className="p-8 lg:p-10">
            <div data-track-block={`team-${m.name.toLowerCase()}`}>
              <div
                className="mb-7 flex h-16 w-16 items-center justify-center"
                style={{ border: `1px solid ${brand.color.blue}`, borderRadius: "var(--radius-sm)" }}
              >
                <span className="t-h2 blue" style={{ fontSize: "1.6rem" }}>{m.name[0]}</span>
              </div>
              <h3 className="t-h2 mb-1.5" style={{ fontSize: "clamp(1.6rem,2.6vw,2.2rem)" }}>{m.name}</h3>
              <p className="t-mono blue mb-5">{m.role}</p>
              <p className="t-body mb-7 max-w-[42ch] opacity-70">{m.focus}</p>
              <div className="flex flex-wrap gap-2">
                {m.skills.map((s) => <span key={s} className="chip">{s}</span>)}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
