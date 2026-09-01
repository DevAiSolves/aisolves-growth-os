import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Services } from "@/components/sections/Services";
import { Engine } from "@/components/sections/Engine";
import { Packages } from "@/components/sections/Packages";
import { Marquee } from "@/components/motion/Marquee";
import { Section } from "@/components/site/Section";
import { SplitReveal } from "@/components/motion/SplitReveal";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Servicios",
  description:
    "SEO, SEM, AIO y GEO. Viralidad con carruseles, historias y reels. Meta y Google Ads con Conversions API. Funnels automatizados y lead scoring conductual.",
};

export default function ServicesPage() {
  return (
    <>
      <Nav />
      <main>
        <Section id="hero" order={1} theme="dark" className="pt-[140px] pb-20">
          <p className="t-mono blue mb-5">Servicios</p>
          <SplitReveal as="h1" className="t-display max-w-[13ch]" label="Todo lo que hace falta para que el dato mande">
            Todo lo que hace falta para que el <span className="serif-accent blue">dato</span> mande.
          </SplitReveal>
          <p className="t-body mt-8 max-w-[60ch] opacity-65">
            Cuatro disciplinas que sólo funcionan juntas: visibilidad que trae al público correcto,
            creatividad que retiene, performance que compra atención con precisión y automatización
            que convierte comportamiento en conversación.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href={`https://wa.me/${brand.whatsapp}`} target="_blank" rel="noopener noreferrer"
              data-track-cta="services-hero" className="btn btn-primary">
              <span>Auditoría de tracking gratuita</span>
            </a>
            <a href="#packages" data-track-cta="services-packages" className="btn btn-ghost">
              <span>Ver paquetes ↓</span>
            </a>
          </div>
        </Section>
        <Marquee items={["SEO", "SEM", "AIO", "GEO", "META ADS", "GOOGLE ADS", "CAPI", "WHATSAPP API", "LEAD SCORING"]} />
        <Services />
        <Engine />
        <Packages />
      </main>
      <Footer />
    </>
  );
}
