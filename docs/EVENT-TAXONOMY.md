# Taxonomía de eventos

> Generado automáticamente desde `src/lib/tracking/taxonomy.ts`.
> No editar a mano — ejecutar `npm run docs:taxonomy`.

Un solo naming (`categoria.accion`, snake_case) para todos los canales. Añadir
una plataforma nueva es añadir una columna en el fichero fuente; ningún
componente cambia.

**`serverSide`** significa que el evento se envía además por Conversions API con
el mismo `event_id` que el Pixel de navegador, para que Meta deduplique y se
quede con la señal de mayor calidad.

**Peso** (0-10) es el valor de negocio que alimenta el motor de scoring.


## Página

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `page.view` | 1 | engage | `PageView` | `page_view` | `Pageview` | ✅ | Route entered (SPA-aware). |
| `page.exit` | 0 | none | — | `page_exit` | — | — | Beacon on pagehide with final dwell + active time. |
| `page.return_visit` | 6 | intent | `ViewContent` | `return_visit` | — | — | Known visitor returning within the attribution window. High intent. |

## Scroll

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `scroll.depth_25` | 1 | engage | — | `scroll` | — | — | Reached 25% of document height. |
| `scroll.depth_50` | 2 | engage | — | `scroll` | — | — | Reached 50%. |
| `scroll.depth_75` | 3 | intent | — | `scroll` | — | — | Reached 75%. Correlates strongly with lead conversion. |
| `scroll.depth_90` | 5 | intent | `ViewContent` | `scroll` | `ViewContent` | ✅ | Read to the end. Retargeting-worthy on its own. |
| `scroll.velocity_slow` | 2 | engage | — | `slow_read` | — | — | Sustained slow scroll over a content block = actual reading, not skimming. |
| `scroll.backtrack` | 3 | intent | — | `scroll_backtrack` | — | — | Scrolled back up to re-read a section. Strong consideration signal. |

## Secciones

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `section.enter` | 1 | engage | — | `section_view` | — | — | Section crossed 50% visibility. |
| `section.exit` | 0 | none | — | `section_exit` | — | — | Section left viewport. Carries dwellMs + maxVisibleRatio. |
| `section.dwell` | 4 | intent | `ViewContent` | `section_dwell` | `ViewContent` | ✅ | Section held >= its dwell threshold. The core interest signal. |
| `section.revisit` | 6 | intent | — | `section_revisit` | — | — | Same section entered 2+ times in one session. Comparison behaviour. |

## Bloques

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `block.enter` | 0 | none | — | `block_view` | — | — | Granular block (card, pricing tier, FAQ row) became visible. |
| `block.dwell` | 2 | intent | — | `block_dwell` | — | — | Block-level attention with dwell time and viewport position. |
| `block.hover` | 2 | intent | — | `block_hover` | — | — | Sustained hover (>600ms) — desktop micro-intent. |
| `block.expand` | 3 | intent | — | `block_expand` | — | — | FAQ / accordion opened. Objection being researched. |

## CTA

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `cta.view` | 1 | engage | — | `cta_view` | — | — | CTA entered viewport. |
| `cta.hover` | 3 | intent | — | `cta_hover` | — | — | Hovered a CTA without clicking. Hesitation = warm. |
| `cta.click` | 7 | intent | `InitiateCheckout` | `cta_click` | `ClickButton` | ✅ | Primary conversion intent. |
| `cta.whatsapp_click` | 8 | intent | `Contact` | `whatsapp_click` | `Contact` | ✅ | Opened WhatsApp. Highest-intent non-form action. |

## Formularios

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `form.start` | 5 | intent | `InitiateCheckout` | `form_start` | — | — | First field focused. |
| `form.field_focus` | 1 | engage | — | `form_field_focus` | — | — | Field entered. Metadata only: name, index, timeToReachMs. |
| `form.field_complete` | 2 | engage | — | `form_field_complete` | — | — | Field left with a valid value. Carries fillMs, length, corrections, pasted. |
| `form.field_error` | 0 | none | — | `form_field_error` | — | — | Validation failed. Friction telemetry. |
| `form.hesitation` | 0 | none | — | `form_hesitation` | — | — | Field focused >8s with no input. Marks the friction field. |
| `form.abandon` | 0 | none | — | `form_abandon` | — | — | Form started, never submitted. Retargeting trigger. |
| `form.submit` | 9 | intent | `Lead` | `generate_lead` | `SubmitForm` | ✅ | Form submitted successfully. |

## Vídeo

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `video.start` | 2 | engage | — | `video_start` | — | — | Playback started. |
| `video.progress_50` | 3 | engage | — | `video_progress` | — | — | Half watched. |
| `video.complete` | 5 | intent | `ViewContent` | `video_complete` | — | ✅ | Watched to the end. |

## Identidad

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `identity.gate_shown` | 0 | none | — | `consent_gate_shown` | — | — | Post-first-scroll consent modal displayed. |
| `identity.consent_granted` | 6 | identity | `ConsentGranted` | `consent_granted` | — | ✅ | Visitor authorised personalised behavioural tracking. |
| `identity.consent_declined` | 0 | none | — | `consent_declined` | — | — | Declined. Collection drops to anonymous aggregate only. |
| `identity.google_login` | 10 | identity | `CompleteRegistration` | `login` | `CompleteRegistration` | ✅ | Authenticated with Google. Identity resolved, PII available for CAPI match. |

## Lead

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `lead.widget_shown` | 0 | none | — | `lead_widget_shown` | — | — | End-of-scroll behavioural-report widget opened. |
| `lead.whatsapp_submitted` | 10 | identity | `Lead` | `generate_lead` | `SubmitForm` | ✅ | Name + WhatsApp captured in exchange for the live behaviour report. |

## Onboarding

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `onboarding.started` | 4 | fit | — | `onboarding_start` | — | — | Entered the asset-connection flow. |
| `onboarding.website_submitted` | 5 | fit | — | `onboarding_website` | — | — | Provided their live website. Enables technical audit. |
| `onboarding.meta_requested` | 6 | fit | — | `onboarding_meta` | — | — | Requested Meta Business asset access. |
| `onboarding.gbp_requested` | 5 | fit | — | `onboarding_gbp` | — | — | Requested Google Business Profile access. |
| `onboarding.completed` | 10 | fit | `Subscribe` | `onboarding_complete` | — | ✅ | All requested assets submitted. Client is activated. |

## Fricción

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `friction.rage_click` | 0 | none | — | `rage_click` | — | — | 3+ clicks in <1s on the same element. UX defect signal. |
| `friction.dead_click` | 0 | none | — | `dead_click` | — | — | Click on a non-interactive element that looks interactive. |
| `friction.exit_intent` | 2 | intent | — | `exit_intent` | — | — | Cursor left toward the browser chrome. Last-chance trigger. |
| `friction.idle` | 0 | none | — | `idle` | — | — | No input for 30s. Pauses activeMs accumulation. |

## Cualificación (derivado en servidor)

| Evento | Peso | Dimensión | Meta | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|
| `qualification.mql` | 0 | none | `QualifiedLead` | `qualified_lead` | — | ✅ | Score crossed the MQL threshold. Emitted server-side only. |
| `qualification.sql` | 0 | none | `QualifiedLead` | `sales_qualified_lead` | — | ✅ | Score crossed the SQL threshold. Triggers human outreach. |

## Pesos por sección

Cada sección declara cuánto tiempo cuenta como atención real (`dwellMs`) y
cuánto multiplica esa atención en el score. Un visitante parado en `packages`
vale mucho más que uno parado en `team`.

| Sección | Umbral de dwell | Multiplicador |
|---|---|---|
| `hero` | 4000 ms | ×0.5 |
| `problem` | 6000 ms | ×1 |
| `engine` | 7000 ms | ×1.4 |
| `services` | 8000 ms | ×1.6 |
| `method` | 8000 ms | ×1.5 |
| `packages` | 6000 ms | ×2.5 |
| `proof` | 5000 ms | ×1.3 |
| `team` | 5000 ms | ×1.1 |
| `faq` | 6000 ms | ×1.7 |
| `contact` | 4000 ms | ×2.2 |

## Contrato del data layer

Cada evento se empuja a `window.dataLayer` con esta forma, lista para GTM:

```js
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
```

Existe además `window._aisDL`, un espejo local del mismo stream que consume el
widget de comportamiento en vivo sin depender de GTM.

## Añadir un evento

1. Declararlo en `src/lib/tracking/taxonomy.ts` con peso, dimensión y mapeos.
2. Emitirlo con `tracker.track("mi.evento", { ...metadata })` — o, mejor, con un
   atributo `data-track-*` para que lo recoja la auto-instrumentación.
3. `npm run docs:taxonomy`.

No hace falta tocar el endpoint de ingesta, el scoring ni el fan-out de píxeles:
todos leen la taxonomía.
