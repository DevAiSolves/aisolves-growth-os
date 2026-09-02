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

**Rol** separa lo que una campaña puede optimizar de lo que es solo medición.
Esta distinción no es cosmética: poner un objetivo de campaña sobre un custom de
scroll o sobre PageView enseña al modelo de puja a comprar scrollers baratos.
Solo los eventos marcados **OPTIMIZAR** representan un compromiso comercial real.


## Página

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `page.view` | 1 | engage | `PageView` | reporting | `page_view` | `Pageview` | ✅ | Route entered (SPA-aware). Reporting only — never an optimisation target. |
| `page.exit` | 0 | none | — | — | `page_exit` | — | — | Beacon on pagehide with final dwell + active time. |
| `page.return_visit` | 6 | intent | `ReturnVisit` | reporting | `return_visit` | — | — | Known visitor returning within the attribution window. High intent. |

## Scroll

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `scroll.depth_25` | 1 | engage | `Scroll25` | reporting | `scroll` | — | — | Reached 25% of document height. Carries msToReach. |
| `scroll.depth_50` | 2 | engage | `Scroll50` | reporting | `scroll` | — | — | Reached 50%. Half of the Quality Visit definition. |
| `scroll.depth_75` | 3 | intent | `Scroll75` | reporting | `scroll` | — | — | Reached 75%. Correlates strongly with lead conversion. |
| `scroll.depth_90` | 5 | intent | `Scroll90` | reporting | `scroll` | — | — | Read to the end. |
| `scroll.depth_100` | 5 | intent | `Scroll100` | reporting | `scroll` | — | — | Hit the absolute bottom, footer included. |
| `scroll.velocity_slow` | 2 | engage | — | — | `slow_read` | — | — | Sustained slow scroll over a content block = actual reading, not skimming. |
| `scroll.backtrack` | 3 | intent | — | — | `scroll_backtrack` | — | — | Scrolled back up to re-read a section. Strong consideration signal. |

## timing

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `time.survived_3s` | 1 | engage | `Time3` | reporting | `time_3s` | — | — | 3s of ACTIVE time. Below this is a bounce with extra steps. |
| `time.survived_8s` | 2 | engage | `Time8` | reporting | `time_8s` | — | — | 8s active. First threshold where the offer can have registered. |
| `time.survived_15s` | 4 | intent | `Time15` | reporting | `time_15s` | — | — | 15s active. Half of the Quality Visit definition. |
| `time.survived_30s` | 5 | intent | `Time30` | reporting | `time_30s` | — | — | 30s active. Reading, not skimming. |
| `time.survived_45s` | 6 | intent | `Time45` | reporting | `time_45s` | — | — | 45s active. Top decile of paid traffic. |
| `time.first_useful_event` | 0 | none | — | — | `time_to_first_event` | — | — | ms from page.view to the first non-pageview event. Measures dead air after load. |

## quality

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `quality.visit` | 8 | intent | `QualityVisit` | **OPTIMIZAR** | `quality_visit` | `ViewContent` | ✅ | ACTIVE time >= 15s AND scroll >= 50%. The mid-funnel event worth optimising against. |
| `quality.offer_viewed` | 7 | intent | `ViewContent` | **OPTIMIZAR** | `view_item` | `ViewContent` | ✅ | Real dwell on the pricing/offer section. THIS is ViewContent — not any scroll. |
| `quality.bounce` | 0 | none | — | — | `bounce` | — | — | Left under 3s active with <25% scroll and zero interaction. |

## Secciones

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `section.enter` | 1 | engage | — | — | `section_view` | — | — | Section crossed 50% visibility. |
| `section.exit` | 0 | none | — | — | `section_exit` | — | — | Section left viewport. Carries dwellMs + maxVisibleRatio. |
| `section.dwell` | 4 | intent | `SectionView` | reporting | `section_dwell` | — | — | Section held >= its dwell threshold. The core interest signal. |
| `section.revisit` | 6 | intent | — | — | `section_revisit` | — | — | Same section entered 2+ times in one session. Comparison behaviour. |

## Bloques

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `block.enter` | 0 | none | — | — | `block_view` | — | — | Granular block (card, pricing tier, FAQ row) became visible. |
| `block.dwell` | 2 | intent | — | — | `block_dwell` | — | — | Block-level attention with dwell time and viewport position. |
| `block.hover` | 2 | intent | — | — | `block_hover` | — | — | Sustained hover (>600ms) — desktop micro-intent. |
| `block.expand` | 3 | intent | — | — | `block_expand` | — | — | FAQ / accordion opened. Objection being researched. |

## CTA

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `cta.view` | 1 | engage | `CTA_View` | reporting | `cta_view` | — | — | CTA reached 80% visibility. Denominator for CTA click-through. |
| `cta.hover` | 3 | intent | — | — | `cta_hover` | — | — | Hovered a CTA without clicking. Hesitation = warm. |
| `cta.click` | 7 | intent | `CTA_Click` | reporting | `cta_click` | `ClickButton` | ✅ | CTA clicked. Reporting only — a services business has no checkout to initiate. |
| `cta.whatsapp_click` | 8 | intent | `Contact` | **OPTIMIZAR** | `whatsapp_click` | `Contact` | ✅ | Opened WhatsApp. Highest-intent non-form action. |

## Formularios

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `form.start` | 5 | intent | `FormStart` | reporting | `form_start` | — | — | First field focused. |
| `form.field_focus` | 1 | engage | — | — | `form_field_focus` | — | — | Field entered. Metadata only: name, index, timeToReachMs. |
| `form.field_complete` | 2 | engage | — | — | `form_field_complete` | — | — | Field left with a valid value. Carries fillMs, length, corrections, pasted. |
| `form.field_error` | 0 | none | — | — | `form_field_error` | — | — | Validation failed. Friction telemetry. |
| `form.hesitation` | 0 | none | — | — | `form_hesitation` | — | — | Field focused >8s with no input. Marks the friction field. |
| `form.field_drop` | 0 | none | `FormFieldDrop` | reporting | `form_field_drop` | — | — | The exact field where the form died. Names the friction instead of guessing it. |
| `form.abandon` | 0 | none | — | — | `form_abandon` | — | — | Form started, never submitted. Retargeting trigger. |
| `form.submit` | 9 | intent | `Lead` | **OPTIMIZAR** | `generate_lead` | `SubmitForm` | ✅ | Form submitted successfully. |

## Vídeo

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `video.start` | 2 | engage | — | — | `video_start` | — | — | Playback started. |
| `video.progress_50` | 3 | engage | — | — | `video_progress` | — | — | Half watched. |
| `video.complete` | 5 | intent | `VideoComplete` | reporting | `video_complete` | — | — | Watched to the end. |

## Identidad

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `identity.gate_shown` | 0 | none | — | — | `consent_gate_shown` | — | — | Post-first-scroll consent modal displayed. |
| `identity.consent_granted` | 6 | identity | `ConsentGranted` | — | `consent_granted` | — | ✅ | Visitor authorised personalised behavioural tracking. |
| `identity.consent_declined` | 0 | none | — | — | `consent_declined` | — | — | Declined. Collection drops to anonymous aggregate only. |
| `identity.google_login` | 10 | identity | `CompleteRegistration` | **OPTIMIZAR** | `login` | `CompleteRegistration` | ✅ | Authenticated with Google. Identity resolved, PII available for CAPI match. |

## Lead

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `lead.widget_shown` | 0 | none | — | — | `lead_widget_shown` | — | — | End-of-scroll behavioural-report widget opened. |
| `lead.whatsapp_submitted` | 10 | identity | `Lead` | **OPTIMIZAR** | `generate_lead` | `SubmitForm` | ✅ | Name + WhatsApp captured in exchange for the live behaviour report. |

## Onboarding

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `onboarding.started` | 4 | fit | — | — | `onboarding_start` | — | — | Entered the asset-connection flow. |
| `onboarding.website_submitted` | 5 | fit | — | — | `onboarding_website` | — | — | Provided their live website. Enables technical audit. |
| `onboarding.meta_requested` | 6 | fit | — | — | `onboarding_meta` | — | — | Requested Meta Business asset access. |
| `onboarding.gbp_requested` | 5 | fit | — | — | `onboarding_gbp` | — | — | Requested Google Business Profile access. |
| `onboarding.completed` | 10 | fit | `Subscribe` | **OPTIMIZAR** | `onboarding_complete` | — | ✅ | All requested assets submitted. Client is activated. |

## Fricción

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `friction.rage_click` | 0 | none | `RageClick` | reporting | `rage_click` | — | — | 3+ clicks in <1s on the same element. UX defect signal. |
| `friction.dead_click` | 0 | none | — | — | `dead_click` | — | — | Click on a non-interactive element that looks interactive. |
| `friction.exit_intent` | 2 | intent | — | — | `exit_intent` | — | — | Cursor left toward the browser chrome. Last-chance trigger. |
| `friction.tab_hidden` | 0 | none | — | — | `tab_hidden` | — | — | Tab backgrounded. Stops the active clock — this is why activeMs is honest. |
| `friction.js_error` | 0 | none | — | — | `js_error` | — | — | Uncaught error or rejection. A broken page cannot convert, and this is usually why. |
| `friction.idle` | 0 | none | — | — | `idle` | — | — | No input for 30s. Pauses activeMs accumulation. |

## Cualificación (derivado en servidor)

| Evento | Peso | Dim. | Meta | Rol | GA4 | TikTok | CAPI | Descripción |
|---|---|---|---|---|---|---|---|---|
| `qualification.mql` | 0 | none | `QualifiedLead` | **OPTIMIZAR** | `qualified_lead` | — | ✅ | Score crossed the MQL threshold. Emitted server-side only. |
| `qualification.sql` | 0 | none | `QualifiedLead` | **OPTIMIZAR** | `sales_qualified_lead` | — | ✅ | Score crossed the SQL threshold. Triggers human outreach. |

## Qué se puede optimizar

**Optimizables (9):** compromisos comerciales reales.

- `quality.visit` → `QualityVisit`
- `quality.offer_viewed` → `ViewContent`
- `cta.whatsapp_click` → `Contact`
- `form.submit` → `Lead`
- `identity.google_login` → `CompleteRegistration`
- `lead.whatsapp_submitted` → `Lead`
- `onboarding.completed` → `Subscribe`
- `qualification.mql` → `QualifiedLead`
- `qualification.sql` → `QualifiedLead`

**Solo reporting (19):** medición. Nunca un objetivo de campaña.


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
