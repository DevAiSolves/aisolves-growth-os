import type { Metadata, Viewport } from "next";
import { Inter_Tight, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { brand } from "@/lib/brand";
import { TrackingProvider } from "@/components/providers/TrackingProvider";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { ConsentGate } from "@/components/capture/ConsentGate";
import { BehaviorWidget } from "@/components/capture/BehaviorWidget";

const interTight = Inter_Tight({
  subsets: ["latin"], variable: "--font-inter-tight",
  weight: ["400", "500", "600"], display: "swap",
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"], variable: "--font-instrument-serif",
  weight: "400", style: ["normal", "italic"], display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aisolves.pro";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AISOLVES — Behavioral Growth OS | SEO · SEM · AIO · GEO",
    template: "%s ✦ AISOLVES",
  },
  description:
    "No vendemos anuncios. Construimos el sistema que lee el comportamiento de cada visitante, lo puntúa en tiempo real y decide quién merece una llamada. SEO, SEM, AIO y GEO con tracking conductual y Meta CAPI.",
  keywords: [
    "trafficker profesional", "Meta Conversions API", "lead scoring conductual",
    "SEO", "SEM", "AIO", "GEO", "funnels automatizados", "embudos de venta",
    "agencia de marketing", "tracking avanzado", "retargeting",
  ],
  authors: [{ name: brand.legalName }],
  openGraph: {
    type: "website", locale: "es_ES", url: siteUrl, siteName: brand.name,
    title: "AISOLVES — El sistema operativo de crecimiento predecible",
    description:
      "Cada scroll, cada hover y cada duda se convierte en dato. Puntuamos el comportamiento en tiempo real y activamos el canal correcto en el momento correcto.",
  },
  twitter: { card: "summary_large_image", title: "AISOLVES — Behavioral Growth OS" },
  robots: { index: true, follow: true, "max-image-preview": "large" },
  alternates: { canonical: siteUrl },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: brand.legalName,
  url: siteUrl,
  description:
    "Agencia de crecimiento especializada en tracking conductual, SEO, SEM, AIO, GEO, virality y arquitecturas automatizadas de conversión.",
  areaServed: "Worldwide",
  knowsAbout: ["SEO", "SEM", "AIO", "GEO", "Meta Ads", "Google Ads", "Conversions API", "Lead Scoring", "Marketing Automation"],
  employee: brand.team.map((t) => ({ "@type": "Person", name: t.name, jobTitle: t.role })),
  serviceType: ["Digital Marketing", "Performance Advertising", "Marketing Automation", "Conversion Rate Optimization"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${interTight.variable} ${instrumentSerif.variable}`}>
      <head>
        {/* Switzer is the reference brand face; Inter Tight is the metric fallback. */}
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f%5B%5D=switzer@400,500,600&display=swap"
        />
        {/* Google Consent Mode v2 must be denied BEFORE any tag loads. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});
gtag('js',new Date());`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="grain">
        <TrackingProvider>
          <SmoothScroll>{children}</SmoothScroll>
          <ConsentGate />
          <BehaviorWidget />
        </TrackingProvider>
      </body>
    </html>
  );
}
