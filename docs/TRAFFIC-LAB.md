# TRAFFIC LAB

Un diagnóstico de tráfico y calidad de señal, no un panel de métricas bonitas.
Vive en `/dashboard/lab` (solo admin) y en `GET /api/lab`.

---

## Las tres reglas que gobiernan todo el módulo

### 1. UU ≠ Sessions ≠ Events ≠ PageViews

Estos cuatro números conviven en el mismo archivo y **no son intercambiables**:

| Métrica | Qué es | Cuándo se usa |
|---|---|---|
| **UU** | Visitantes distintos | Denominador de TODO porcentaje de funnel |
| **Sessions** | Visitas continuas (corte a 30 min de inactividad) | Frecuencia, no alcance |
| **Events** | Disparos brutos | Puede superar a UU, y a menudo debe |
| **Events/UU** | Ratio | `>1` significa repetición, nunca alcance |

Un click de Ads Manager **no** es un UU de landing. Si alguien te pasa "clicks"
y los tratas como usuarios, todos los porcentajes de abajo quedan inflados.

### 2. ⚫ es un estado de primera clase

Cuando una métrica no se puede medir, devuelve `null` y se pinta ⚫ con trama
diagonal. **Nunca se sustituye por cero.** Un dato que no existe no es un dato
que valga 0, y un panel que pinta rojo sobre algo que no midió enseña al cliente
a desconfiar del resto de luces.

Lo mismo aplica al score compuesto: los componentes sin medir se **excluyen y se
renormalizan**, y la cabecera declara la cobertura (`conf. alta / media / baja`).

### 3. Paid y organic nunca comparten fila

Se calculan como segmentos separados. Un bounce mezclado esconde justo la mitad
que está rota — que es la mitad que necesitabas encontrar.

---

## Semáforo

| Luz | Regla |
|---|---|
| 🟢 | ≥ 70 % del benchmark |
| 🟡 | 40 % – 69,9 % |
| 🔴 | < 40 %, **o** rotura crítica: 0 disparos, EMQ < 5, mismatch Pixel/CAPI > 30 % |
| ⚫ | Sin medición |

Las roturas críticas hacen cortocircuito: 0 disparos es 🔴 aunque el porcentaje
salga bien, porque un evento que no existe no puede estar sano.

### Benchmarks por defecto

Declarados como **default de industria**, no como ley. Sustitúyelos por el
histórico del propio cliente en cuanto haya 3-4 semanas de datos.

| Métrica | Objetivo |
|---|---|
| LCP | < 2,5 s |
| Bounce (paid) | < 55 % |
| Scroll 50 | ≥ 45 % UU |
| Scroll 75 | ≥ 28 % UU |
| Tiempo ≥ 15 s | ≥ 35 % UU |
| Quality Visit | ≥ 25 % UU |
| CTA visto | ≥ 60 % UU |
| CTA click / view | 8 – 15 % |
| Form start → submit | ≥ 30 % |
| EMQ | ≥ 7,0 |
| Dedup Pixel↔CAPI | ≥ 80 % |
| PageView events/UU | 1,0 – 1,3 |

---

## Cómo leer la tabla de movimientos

Dos bases distintas conviven en la misma fila, y confundirlas es el error de
lectura más común:

- **`% UU`** es siempre sobre UU entrada.
- **La barra** mide cumplimiento del benchmark propio de esa fila.

Por eso *Form submitted* puede marcar 1,2 % de UU y salir verde con la barra
llena: su benchmark es sobre *form starts*, no sobre UU. La columna se titula
explícitamente **Barra (vs benchmark)**.

**Métricas invertidas** (Bounce, Rage/dead click) llenan **hacia el problema**:
más barra = peor. Van marcadas «barra invertida» en la nota.

---

## Quality Visit

```
activeMs >= 15000  AND  scrollPct >= 50
```

Las dos condiciones, nunca una. Es el único evento de mitad de embudo que vale
la pena dar a Meta como objetivo de optimización: no se puede falsear con un
scroll rápido ni con una pestaña abierta de fondo.

**Tiempo ACTIVO** significa: pestaña visible **y** algún input en los últimos
30 s. Nada más cuenta.

---

## Optimizable vs solo reporting

Cada evento declara `metaRole` en la taxonomía. La distinción no es cosmética:
poner un objetivo de campaña sobre un custom de scroll enseña al modelo de puja
a comprar scrollers baratos.

**Optimizables** — compromisos comerciales reales:
`quality.visit` → `QualityVisit` · `quality.offer_viewed` → `ViewContent` ·
`lead.whatsapp_submitted` / `form.submit` → `Lead` ·
`cta.whatsapp_click` → `Contact` · `identity.google_login` → `CompleteRegistration` ·
`onboarding.completed` → `Subscribe`

**Solo reporting** — medición: `PageView`, `Scroll25/50/75/90/100`,
`Time3/8/15/30/45`, `SectionView`, `CTA_View`, `CTA_Click`, `FormStart`,
`FormFieldDrop`, `RageClick`, `VideoComplete`, `ReturnVisit`.

### Eventos standard que se corrigieron

La instalación original abusaba de eventos standard de Meta. Se corrigió:

| Evento | Antes | Ahora | Por qué |
|---|---|---|---|
| `cta.click` | `InitiateCheckout` | `CTA_Click` (reporting) | Un negocio de servicios no tiene checkout que iniciar |
| `section.dwell` | `ViewContent` | `SectionView` (reporting) | Un ViewContent por cada sección envenena la señal |
| `scroll.depth_90` | `ViewContent` | `Scroll90` (reporting) | Hacer scroll no es ver contenido |
| `form.start` | `InitiateCheckout` | `FormStart` (reporting) | Enfocar un campo no es iniciar una compra |
| `video.complete` | `ViewContent` | `VideoComplete` (reporting) | Idem |
| — | — | `quality.offer_viewed` → `ViewContent` | **Este** sí: dwell real sobre el precio |

---

## EMQ: siempre ESTIMADO

Meta calcula el EMQ real (0-10) contra su propio grafo. **No es derivable desde
nuestro lado.** Lo que devuelve `src/lib/analytics/emq.ts` es el *techo*
plausible según las claves que efectivamente transmitimos, ponderadas:

`em 2.6 · ph 2.0 · external_id 1.5 · fbc 1.0 · fbp 0.8 · ip 0.6 · ua 0.5 · fn 0.4 · ln 0.3 · country 0.2 · ct 0.1`

El real siempre es **≤** éste: un email hasheado que no existe en el grafo de
Meta cuenta como enviado aquí y no casa con nada allí. Contrástalo en
Events Manager → Data Sources → tu píxel → Overview.

---

## Dedup Pixel ↔ CAPI

El denominador son **solo los eventos donde CAPI se intentó** (`serverSide:
true`). Los eventos de reporting no tienen contraparte de servidor por diseño;
incluirlos hacía que una instalación sana reportara un match rate roto.

| Estado | Significado |
|---|---|
| `matched` | Ambos lados con el mismo `event_id`. Correcto. |
| `capiOnly` | El Pixel de navegador fue bloqueado. **CAPI haciendo su trabajo** — señal recuperada, no error. |
| `pixelOnly` | El servidor nunca lo envió. **Gap real**: los eventos server-side sobreviven a los bloqueadores. |

`pixelFired` lo **reporta el cliente**, no se asume. Asumir que la llamada del
navegador tuvo éxito es incorrecto entre un 20 % y un 40 % de las veces — que es
exactamente el número que este módulo existe para medir.

---

## Motion 2026

Tres capas progresivas, la de abajo siempre funciona. Detalle completo en
[`docs/MOTION-2026.md`](MOTION-2026.md).

---

## Datos sintéticos para demo

```bash
npm run seed:traffic          # 400 visitantes sintéticos
npm run seed:traffic -- --clean
```

Todo visitante generado lleva `anonId` con prefijo `synthetic-`, se borra en una
query y **nunca puede confundirse con comportamiento medido**. El script se
niega a ejecutarse contra una `DATABASE_URL` que no sea local.
