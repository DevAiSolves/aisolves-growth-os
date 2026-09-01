/**
 * BRAND BOOK — single source of truth.
 * Every colour, radius and motion constant in the product resolves here or to
 * the CSS custom properties it generates. Changing a value here changes the
 * site, the modal, the widget and the dashboard together.
 */

export const brand = {
  name: "AISOLVES",
  legalName: "AISOLVES Growth Systems",
  tagline: "El sistema operativo de crecimiento predecible",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? "34600000000",
  email: "hola@aisolves.pro",
  domain: process.env.NEXT_PUBLIC_SITE_URL ?? "https://aisolves.pro",

  color: {
    ink: "#000000",
    cream: "#FFF5EF",
    blue: "#0028FF",
    blueSoft: "rgba(0, 40, 255, 0.15)",
    graphite: "#201D1D",
    hairline: "#807B78",
    white: "#FFFFFF",
  },

  radius: { xs: "2px", sm: "4px", md: "8px", lg: "12px", pill: "999px" },

  motion: {
    ease: "cubic-bezier(0.65, 0.01, 0.05, 0.99)",
    easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    fast: 0.4,
    base: 0.8,
    slow: 1.2,
  },

  team: [
    {
      name: "Javier",
      role: "CEO · Growth Architect",
      focus: "Arquitectura de conversión, tracking multicanal, full stack UX/UI y campañas como trafficker profesional.",
      skills: ["Meta Pixel + CAPI", "Full Stack / UX-UI", "Funnels end-to-end", "Lead scoring conductual", "AI aplicada a conversión"],
    },
    {
      name: "Milagros",
      role: "CMO · Content & Virality",
      focus: "Contenido orgánico, storytelling de venta, community management avanzado y tráfico con estrategias exclusivas.",
      skills: ["Storytelling LIFE", "Reels · Carruseles · Historias", "Community management", "Funnels de contenido", "Trafficker profesional"],
    },
  ],

  disciplines: ["SEO", "SEM", "AIO", "GEO"],
} as const;

export type Brand = typeof brand;
