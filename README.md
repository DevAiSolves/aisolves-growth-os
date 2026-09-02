# AISOLVES — Behavioral Growth OS

Website + motor de tracking conductual + calificación de leads + dashboard, en un
solo repositorio Next.js.

No es una web con Google Analytics encima. Es un instrumento de lectura de
comportamiento: cada sección, bloque y campo emite eventos estructurados, un
motor de scoring convierte ese ruido en un número de 0 a 100 por visitante, y
ese número se devuelve a Meta y Google **por servidor** para que sus algoritmos
optimicen con la señal completa.

---

## Índice

- [Arranque rápido](#arranque-rápido)
- [Qué hace exactamente](#qué-hace-exactamente)
- [Arquitectura](#arquitectura)
- [El motor de scoring](#el-motor-de-scoring)
- [Instrumentar una sección nueva](#instrumentar-una-sección-nueva)
- [Configurar píxeles y CAPI](#configurar-píxeles-y-capi)
- [Despliegue](#despliegue)
- [Documentación](#documentación)

---

## Arranque rápido

```bash
npm install
cp .env.example .env      # rellena AUTH_SECRET (npx auth secret)
docker compose up -d      # Postgres 16 en :5432
npm run db:deploy         # aplica las migraciones
npm run db:seed           # paquetes comerciales
npm run seed:traffic      # 300 visitantes sintéticos para ver el Traffic Lab
npm run dev
```

Abre <http://localhost:3000>. No hacen falta credenciales OAuth ni píxeles para
ver el sistema de tracking funcionando de punta a punta: haz scroll, acepta el
gate, llega al final y deja tu WhatsApp en el widget.

> **Por qué Postgres y no SQLite.** SQLite no puede respaldar un despliegue
> serverless: el sistema de ficheros es efímero y de solo lectura, así que toda
> escritura se perdería o fallaría. `docker compose up -d` deja el entorno local
> igual de sencillo con un solo comando.

Para probar el pipeline completo: haz scroll → aparece el gate de consentimiento
→ acepta → llega al final → aparece el widget → deja nombre y WhatsApp → recibes
tu propio informe conductual calculado en servidor.

---

## Qué hace exactamente

### 1. Absorción de metadata

Auto-instrumentación declarativa. Cualquier marcado se suma con atributos
`data-track-*`, sin escribir código de tracking por componente:

| Atributo | Qué mide |
|---|---|
| `data-track-section="packages"` | enter / exit / dwell / revisit, con ratio de visibilidad |
| `data-track-block="tier-scale"` | enter / dwell / hover sostenido, con posición en viewport |
| `data-track-cta="hero-primary"` | view / hover de duda / click |
| `data-track-form="whatsapp-widget"` | metadata por campo: tiempo de llenado, correcciones, pegado, dudas |
| `data-track-video="manifesto"` | start / 50% / complete |
| `data-track-expand="faq-3"` | apertura de acordeón (objeción investigada) |

Además, sin configuración: profundidad y velocidad de scroll, retrocesos de
lectura, rage clicks, dead clicks, intención de salida, tiempo activo real
(descontando pestañas en segundo plano e inactividad).

**Privacidad:** los colectores de formularios leen longitud, validez, tiempo y
número de correcciones. **Nunca leen, envían ni almacenan el valor escrito.**

### 2. Puntuación conductual

Cuatro dimensiones con tope independiente, para que ningún comportamiento aislado
se desboque:

| Dimensión | Máx | Qué responde |
|---|---|---|
| Intención | 40 | ¿Se comporta como alguien a punto de comprar? |
| Engagement | 25 | ¿Ha consumido el contenido de verdad? |
| Fit | 20 | ¿Sus activos declarados encajan con nuestro ICP? |
| Identidad | 15 | ¿Cuán resoluble es? |

Total 0-100 → banda → decisión operativa:

| Banda | Score | Acción | SLA |
|---|---|---|---|
| SQL | 90+ | Llamada directa del CEO | < 15 min |
| MQL | 75-89 | Mensaje personal 1:1 citando su comportamiento | < 1 h |
| HOT | 50-74 | Nutrición agresiva + retargeting 1:1 | < 4 h |
| WARM | 25-49 | Retargeting de contenido + email de valor | < 24 h |
| COLD | < 25 | Audiencia de awareness, sin contacto humano | — |

### 3. TRAFFIC LAB — diagnóstico de tráfico

`/dashboard/lab` entrega el laboratorio: 20 movimientos con semáforo estricto y
barras que se completan con el scroll, histograma de supervivencia sobre tiempo
activo, funnel por sección, timeline del UU mediano, y el split entre lo que
Meta puede optimizar y lo que es solo reporting.

Tres reglas lo gobiernan: **UU ≠ Sessions ≠ Events**, **⚫ nunca se sustituye por
cero**, y **paid y organic jamás comparten fila**. Detalle en
[`docs/TRAFFIC-LAB.md`](docs/TRAFFIC-LAB.md).

### 4. Activación multicanal

Meta Pixel + Conversions API, Google Consent Mode v2 + GA4 Measurement Protocol,
TikTok Events API y LinkedIn — todos alimentados desde la misma taxonomía.

### 5. Captura en dos etapas

- **Gate post-scroll:** tras el primer scroll real, ofrece login con Google o
  aceptación explícita, a cambio de mostrarle su propio informe conductual.
- **Widget de fin de scroll:** nombre + WhatsApp a cambio del informe en vivo.
  Convierte porque no es un lead magnet: es una demostración del producto sobre
  el propio prospecto.
- **Onboarding etapa 2:** ya dentro, se piden accesos a Meta Business, Google
  Business Profile y la web actual — nunca antes, porque pedirlos en el primer
  contacto destruye la conversión.

---

## Arquitectura

```
Navegador                          Servidor                    Plataformas
─────────                          ────────                    ───────────
collectors.ts                      /api/track
  observers de sección/bloque        ├─ upsert Visitor
  metadata de formularios            ├─ persiste stream de eventos
  scroll / fricción                  ├─ recalcula score  ────►  Meta CAPI
        │                            └─ dispara qualification    (mismo event_id)
        ▼                                                            │
   client.ts (cola)  ──── batch / beacon ────►                       │
        │                                                            ▼
        └── pixels.ts ─── Meta Pixel (eventID) ──────────► deduplicado
                      ─── gtag / GA4
                      ─── TikTok ttq
```

**Reglas de transporte:** batch cada 4 s, flush inmediato con 20 eventos en cola
o ante cualquier evento de peso ≥ 7 (una conversión no espera detrás de un lote),
`navigator.sendBeacon` en `pagehide`, y reencolado en cabeza si la red falla.

### Ficheros clave

| Ruta | Qué es |
|---|---|
| `src/lib/tracking/taxonomy.ts` | Fuente de verdad: eventos, pesos, mapeo por canal |
| `src/lib/tracking/scoring.ts` | Motor de scoring (funciones puras, compartido cliente/servidor) |
| `src/lib/tracking/collectors.ts` | Auto-instrumentación declarativa |
| `src/lib/tracking/client.ts` | Singleton: identidad, sesión, cola, tiempo activo |
| `src/lib/capi/meta.ts` | Conversions API con hashing SHA-256 y deduplicación |
| `src/lib/leads.ts` | Envío de leads con cola de reintento persistente |
| `src/app/api/track/route.ts` | Ingesta, agregación, rescoring y fan-out |
| `prisma/schema.prisma` | Modelo de datos completo |

---

## El motor de scoring

`scoreVisitor()` en `src/lib/tracking/scoring.ts` son **funciones puras sin I/O**.
Eso es deliberado: el navegador y el servidor ejecutan exactamente el mismo
código, así que el número que ve el visitante en su informe es el mismo que ve el
equipo en el dashboard. Si divergieran, la demostración dejaría de ser creíble.

Ajustar el modelo a un negocio concreto = editar dos sitios:

- `SECTION_WEIGHTS` en `taxonomy.ts` — cuánto vale la atención en cada sección.
- Los bloques `INTENT` / `ENGAGE` / `FIT` en `scoring.ts`.

---

## Instrumentar una sección nueva

```tsx
<Section id="testimonios" order={9} theme="light">
  <div data-track-block="caso-acme">
    <h3>Acme: 3,2× ROAS en 90 días</h3>
    <a href="/casos/acme" data-track-cta="caso-acme-link">Ver el caso</a>
  </div>
</Section>
```

Eso es todo. `enter`, `exit`, `dwell`, `revisit`, hover y click quedan medidos,
enviados a los píxeles y puntuados. Añade la sección a `SECTION_WEIGHTS` si
quieres darle un peso propio.

---

## Configurar píxeles y CAPI

1. **Meta** — Events Manager → tu píxel → Settings → *Generate access token*.
   Rellena `NEXT_PUBLIC_META_PIXEL_ID`, `META_PIXEL_ID` y `META_CAPI_TOKEN`.
2. Verifica en **Test Events** con `META_TEST_EVENT_CODE`.
   **Quita esa variable en producción** o los eventos se quedan en la pestaña de
   test y nunca llegan al optimizador.
3. Comprueba en Events Manager que la deduplicación aparece como *Browser +
   Server* y no como dos eventos separados.
4. **Google** — GA4 Admin → Data Streams → Measurement Protocol API secrets.

Sin estas variables el sistema funciona igual: el fan-out se salta limpiamente y
lo indica en la respuesta de `/api/track`.

---

## Despliegue

Ver [`docs/DEPLOY.md`](docs/DEPLOY.md). Resumen: cambia el `provider` de Prisma a
`postgresql`, apunta `DATABASE_URL` a tu base gestionada, configura las URLs de
callback OAuth y despliega.

---

## Documentación

- [`docs/TRAFFIC-LAB.md`](docs/TRAFFIC-LAB.md) — el diagnóstico de tráfico:
  disciplina UU, semáforo, benchmarks, EMQ y dedup Pixel↔CAPI.
- [`docs/MOTION-2026.md`](docs/MOTION-2026.md) — el sistema de motion en tres
  capas progresivas (`animation-trigger`, scroll-driven, `@property`).
- [`docs/EVENT-TAXONOMY.md`](docs/EVENT-TAXONOMY.md) — los 61 eventos con su
  mapeo por canal y el rol optimizar/reporting. **Generado desde el código**
  (`npm run docs:taxonomy`).
- [`docs/TRACKING-ARCHITECTURE.md`](docs/TRACKING-ARCHITECTURE.md) — decisiones
  de diseño, deduplicación, privacidad y cumplimiento.
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — producción, OAuth y píxeles.

---

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · GSAP + ScrollTrigger +
SplitText · Lenis · Prisma · NextAuth v5 · Zod

## Equipo

**Javier** — CEO · Growth Architect. Arquitectura de conversión, tracking
multicanal, full stack UX/UI, campañas como trafficker profesional.

**Milagros** — CMO · Content & Virality. Contenido orgánico, storytelling de
venta, community management avanzado, tráfico con estrategias exclusivas.
