"use client";

import { useState } from "react";
import { Section, SectionLabel } from "@/components/site/Section";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { faqs } from "@/content/faqs";


export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" order={8} theme="dark" className="py-24 lg:py-32">
      <SectionLabel index="07">Preguntas</SectionLabel>
      <SplitReveal as="h2" className="t-h1 mt-6 max-w-[16ch]">
        Las dudas que <span className="serif-accent blue">sí</span> importan.
      </SplitReveal>

      <div className="mt-14 max-w-[860px]">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="hairline-t" data-track-block={`faq-${i}`}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                data-track-expand={`faq-${i}`}
                data-track-expand-label={f.q}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-6 py-6 text-left"
                style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontFamily: "inherit" }}
              >
                <span className="t-h3">{f.q}</span>
                <span
                  className="blue mt-1 shrink-0 transition-transform duration-500"
                  style={{ transform: isOpen ? "rotate(45deg)" : "none", fontSize: 18, lineHeight: 1 }}
                  aria-hidden
                >
                  +
                </span>
              </button>
              <div
                className="overflow-hidden transition-[max-height,opacity] duration-500"
                style={{
                  maxHeight: isOpen ? 340 : 0,
                  opacity: isOpen ? 1 : 0,
                  transitionTimingFunction: "cubic-bezier(0.65,0.01,0.05,0.99)",
                }}
              >
                <p className="t-body max-w-[68ch] pb-7 opacity-65">{f.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

