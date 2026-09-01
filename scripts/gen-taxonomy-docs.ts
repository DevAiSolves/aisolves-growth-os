/**
 * Generates docs/EVENT-TAXONOMY.md from the taxonomy source.
 * Run: npm run docs:taxonomy
 * Docs that are written by hand drift from the code within one sprint.
 */
import { writeFileSync } from "fs";
import { EVENTS, SECTION_WEIGHTS, type EventSpec } from "../src/lib/tracking/taxonomy";

const rows = Object.entries(EVENTS) as [string, EventSpec][];
const byCategory = rows.reduce<Record<string, [string, EventSpec][]>>((acc, r) => {
  (acc[r[1].category] ??= []).push(r);
  return acc;
}, {});

const cell = (v?: string | boolean) =>
  v === true ? "✅" : v === false || v === undefined ? "—" : `\`${v}\``;

let md = `# Taxonomía de eventos

> Generado automáticamente desde \`src/lib/tracking/taxonomy.ts\`.
> No editar a mano — ejecutar \`npm run docs:taxonomy\`.

Un solo naming (\`categoria.accion\`, snake_case) para todos los canales. Añadir
una plataforma nueva es añadir una columna en el fichero fuente; ningún
componente cambia.

**\`serverSide\`** significa que el evento se envía además por Conversions API con
el mismo \`event_id\` que el Pixel de navegador, para que Meta deduplique y se
quede con la señal de mayor calidad.

**Peso** (0-10) es el valor de negocio que alimenta el motor de scoring.

`;

const CATEGORY_TITLES: Record<string, string> = {
  page: "Página", scroll: "Scroll", section: "Secciones", block: "Bloques",
  cta: "CTA", form: "Formularios", video: "Vídeo", identity: "Identidad",
  lead: "Lead", onboarding: "Onboarding", friction: "Fricción",
  qualification: "Cualificación (derivado en servidor)",
};

for (const [cat, items] of Object.entries(byCategory)) {
  md += `\n## ${CATEGORY_TITLES[cat] ?? cat}\n\n`;
  md += `| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;
  for (const [name, s] of items) {
    md += `| \`${name}\` | ${s.weight} | ${s.scoreDim} | ${cell(s.meta)} | ${cell(s.ga4)} | ${cell(s.tiktok)} | ${cell(s.serverSide)} | ${s.description} |\n`;
  }
}

md += `\n## Pesos por sección\n\n`;
md += `Cada sección declara cuánto tiempo cuenta como atención real (\`dwellMs\`) y\n`;
md += `cuánto multiplica esa atención en el score. Un visitante parado en \`packages\`\n`;
md += `vale mucho más que uno parado en \`team\`.\n\n`;
md += `| Sección | Umbral de dwell | Multiplicador |\n|---|---|---|\n`;
for (const [id, w] of Object.entries(SECTION_WEIGHTS)) {
  md += `| \`${id}\` | ${w.dwellMs} ms | ×${w.multiplier} |\n`;
}

md += `
## Contrato del data layer

Cada evento se empuja a \`window.dataLayer\` con esta forma, lista para GTM:

\`\`\`js
{
  event: "section.dwell",       // nombre de la taxonomía
  ais_event_id: "uuid-v4",      // clave de deduplicación Pixel <-> CAPI
  ais_category: "section",
  ais_weight: 4,
  ais_section: "packages",
  ais_block: undefined,
  ais_path: "/",
  // ...metadata específica del evento
  dwellMs: 8420,
  visits: 2,
  quality: "full"
}
\`\`\`

Existe además \`window._aisDL\`, un espejo local del mismo stream que consume el
widget de comportamiento en vivo sin depender de GTM.

## Añadir un evento

1. Declararlo en \`src/lib/tracking/taxonomy.ts\` con peso, dimensión y mapeos.
2. Emitirlo con \`tracker.track("mi.evento", { ...metadata })\` — o, mejor, con un
   atributo \`data-track-*\` para que lo recoja la auto-instrumentación.
3. \`npm run docs:taxonomy\`.

No hace falta tocar el endpoint de ingesta, el scoring ni el fan-out de píxeles:
todos leen la taxonomía.
`;

writeFileSync("docs/EVENT-TAXONOMY.md", md);
console.log(`Wrote docs/EVENT-TAXONOMY.md — ${rows.length} events, ${Object.keys(byCategory).length} categories.`);
