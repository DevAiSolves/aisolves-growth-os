import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Method } from "@/components/sections/Method";
import { Problem } from "@/components/sections/Problem";
import { Faq } from "@/components/sections/Faq";
import { Section } from "@/components/site/Section";
import { SplitReveal } from "@/components/motion/SplitReveal";

export const metadata: Metadata = {
  title: "Método",
  description:
    "90 días para instrumentar, encender y escalar. Las 6 etapas del negocio con teoría de restricciones aplicada a marketing.",
};

const stages = [
  { n: "01", t: "Marketing", d: "Atención comprada y ganada. Se mide por coste de atención cualificada, no por alcance." },
  { n: "02", t: "Sales", d: "Conversación. Se mide por lead-to-opportunity rate y velocidad de respuesta." },
  { n: "03", t: "Closing", d: "Decisión. Se mide por show-up rate y conversion velocity." },
  { n: "04", t: "Onboarding", d: "El punto de mayor impacto en LTV y churn. Primeras 48-72 h, medidas y automatizadas." },
  { n: "05", t: "Delivery", d: "Ejecución. Se mide por time-to-value, no por horas invertidas." },
  { n: "06", t: "Post-sale", d: "Expansión y referidos. Donde el sistema empieza a componer." },
];

export default function MethodPage() {
  return (
    <>
      <Nav />
      <main>
        <Section id="hero" order={1} theme="dark" className="pt-[140px] pb-20">
          <p className="t-mono blue mb-5">Método</p>
          <SplitReveal as="h1" className="t-display max-w-[14ch]" label="Todo sistema opera a la velocidad de su cuello de botella">
            Todo sistema opera a la velocidad de su <span className="serif-accent blue">cuello de botella</span>.
          </SplitReveal>
          <p className="t-body mt-8 max-w-[62ch] opacity-65">
            No optimizamos todo a la vez. Identificamos en cuál de las seis etapas del negocio
            está la restricción real, la atacamos hasta moverla, y sólo entonces pasamos a la
            siguiente. Optimizar una etapa que no es el constraint no cambia el resultado —
            sólo genera informes bonitos.
          </p>
        </Section>

        <Section id="engine" order={2} theme="light" className="py-24">
          <p className="t-mono blue mb-5">Las 6 etapas</p>
          <h2 className="t-h1 mb-14 max-w-[18ch]">Un negocio es una cadena. Medimos los seis eslabones.</h2>
          <div className="grid gap-px md:grid-cols-2 lg:grid-cols-3" style={{ background: "var(--line)" }}>
            {stages.map((s) => (
              <div key={s.n} data-track-block={`stage-${s.n}`} className="p-7"
                style={{ background: "var(--color-cream)" }}>
                <p className="t-mono blue mb-4">{s.n}</p>
                <h3 className="t-h3 mb-2">{s.t}</h3>
                <p className="t-body opacity-65">{s.d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Problem />
        <Method />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
