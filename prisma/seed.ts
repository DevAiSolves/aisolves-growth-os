import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const packages = [
  {
    slug: "signal", name: "Signal", tagline: "Empieza a ver lo que ya está pasando.",
    priceFrom: 1200, targetTemp: "WARM", sortOrder: 1,
    features: [
      "Auditoría completa de pérdida de señal",
      "Taxonomía de eventos unificada",
      "Meta Pixel + Conversions API deduplicados",
      "Google Consent Mode v2 + GA4 server-side",
      "Motor de lead scoring conductual",
      "Dashboard de comportamiento en tiempo real",
    ],
  },
  {
    slug: "engine", name: "Engine", tagline: "El sistema completo, funcionando solo.",
    priceFrom: 2900, targetTemp: "HOT", sortOrder: 2,
    features: [
      "Todo lo incluido en Signal",
      "Gestión de Meta Ads y Google Ads",
      "Retargeting por comportamiento y secuencias progresivas",
      "Contenido orgánico: reels, carruseles e historias",
      "WhatsApp Business API con detección de intención",
      "Nutrición de preventa automatizada multicanal",
      "SEO técnico + AIO / GEO",
    ],
  },
  {
    slug: "compound", name: "Compound", tagline: "Crecimiento que se acelera con el tiempo.",
    priceFrom: 5500, targetTemp: "MQL", sortOrder: 3,
    features: [
      "Todo lo incluido en Engine",
      "Onboarding de alta activación (48-72 h)",
      "Arquitectura completa de las 6 etapas del negocio",
      "Estrategia de viralidad con activos combinados",
      "Modelado de atribución multi-touch",
      "Sesión estratégica semanal con CEO y CMO",
      "SLA de contacto < 15 min para leads SQL",
    ],
  },
];

async function main() {
  for (const p of packages) {
    await prisma.package.upsert({
      where: { slug: p.slug },
      create: { ...p, features: JSON.stringify(p.features) },
      update: { ...p, features: JSON.stringify(p.features) },
    });
  }
  console.log(`Seeded ${packages.length} packages.`);
}

main().finally(() => prisma.$disconnect());
