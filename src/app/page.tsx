import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { Engine } from "@/components/sections/Engine";
import { Services } from "@/components/sections/Services";
import { Method } from "@/components/sections/Method";
import { Packages } from "@/components/sections/Packages";
import { Team } from "@/components/sections/Team";
import { Faq } from "@/components/sections/Faq";
import { faqJsonLd } from "@/content/faqs";
import { Marquee } from "@/components/motion/Marquee";

const strip = [
  "META PIXEL + CAPI", "LEAD SCORING CONDUCTUAL", "SEO · SEM · AIO · GEO",
  "WHATSAPP BUSINESS API", "RETARGETING POR COMPORTAMIENTO",
  "CONSENT MODE V2", "FUNNELS AUTOMATIZADOS", "VIRALIDAD ORGÁNICA",
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Nav />
      <main>
        <Hero />
        <Marquee items={strip} />
        <Problem />
        <Engine />
        <Services />
        <Method />
        <Packages />
        <Team />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
