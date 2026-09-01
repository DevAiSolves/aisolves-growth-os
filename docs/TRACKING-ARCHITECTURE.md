# Arquitectura de tracking — decisiones y porqués

Este documento explica **por qué** el sistema está construido así. Las decisiones
que parecen detalles menores son las que separan un ROAS reportado de un ROAS
real.

---

## 1. Deduplicación Pixel ↔ CAPI

### El problema

El Pixel de navegador pierde entre un 20 % y un 40 % de los eventos por ITP de
Safari, ATT en iOS, bloqueadores y límites de cookies de terceros. Cada evento
perdido es una conversión que el algoritmo de puja de Meta **nunca aprende**. El
modelo se degrada, el CPA sube con el tiempo y nadie sabe explicar por qué.

### Los dos errores habituales

- **Solo navegador:** pierdes esa señal.
- **Navegador + servidor sin `event_id` compartido:** Meta cuenta cada conversión
  dos veces. Tus informes mejoran y tu modelo de puja empeora, que es el peor
  resultado posible porque nadie lo detecta.

### La implementación correcta

Un único UUID por evento, generado en el cliente, se usa como:

- `eventID` en la llamada `fbq('track', ...)` del navegador,
- `event_id` en la llamada a la Conversions API desde el servidor,
- clave primaria `Event.eventId` en la base de datos, con índice único.

Meta deduplica sobre `(event_name, event_id)` y conserva la copia con mejor
señal de match. El índice único además hace que un `sendBeacon` reintentado o un
lote duplicado no puedan inflar las métricas.

**Verificación:** Events Manager debe mostrar los eventos como *Browser + Server*
en una sola fila. Si aparecen como dos filas, la deduplicación no está
funcionando.

---

## 2. Tiempo activo, no tiempo en página

"Tiempo en página" es la métrica más mentirosa del analytics estándar: cuenta
pestañas de fondo, gente que fue a comer y sesiones que nunca se cerraron.

Aquí `activeMs` sólo acumula cuando se cumplen **las dos** condiciones:

- `document.visibilityState === "visible"`, y
- ha habido input (ratón, teclado, scroll, táctil) en los últimos 30 s.

Al superar el umbral se emite `friction.idle` y el reloj se detiene. Por eso un
"62 s de atención real" en el informe significa 62 segundos de verdad, y por eso
el score es defendible delante de un cliente.

---

## 3. Metadata de formularios sin leer valores

Los colectores de formularios capturan:

- `fillMs` — cuánto se tarda en completar el campo,
- `corrections` — pulsaciones de borrado (duda),
- `pasted` — si el valor se pegó,
- `length`, `valid` — longitud y validez,
- `timeToReachMs` — cuánto tardó en llegar a ese campo,
- `form.hesitation` — campo enfocado 8 s sin escribir nada.

Nunca se lee `field.value` para enviarlo. Esto no es sólo cumplimiento: el valor
del campo no aporta nada al scoring, y capturarlo convertiría un sistema de
medición en un riesgo legal.

El campo con más `hesitation` y `corrections` de un formulario es, casi siempre,
el que hay que quitar.

---

## 4. Resolución de identidad

La escalera, y los puntos que aporta cada peldaño:

| Etapa | Puntos | Cómo se llega |
|---|---|---|
| `anonymous` | 0 | Primer paint. Existe antes de cualquier consentimiento. |
| `consented` | 5 | Aceptación explícita en el gate. |
| `identified` | 9 | Dejó nombre + WhatsApp en el widget. |
| `authenticated` | 12 | Login con Google. |
| `client` | 15 | Onboarding completado. |

**El paso crítico** está en `events.signIn` de `src/lib/auth.ts` y en
`/api/identify`: al resolverse la identidad, el historial conductual anónimo se
enlaza con la persona real. Sin ese paso, todo el comportamiento previo al login
queda huérfano y el score arranca de cero — el fallo más común en los sistemas de
tracking caseros.

---

## 5. Consentimiento y cumplimiento

- **Google Consent Mode v2** se inicializa en `denied` en el `<head>`, antes de
  que cargue ninguna etiqueta. Ésa es la postura conforme; inicializar en
  `granted` y "corregir" después no cumple.
- **Ad-tech bajo demanda:** los píxeles no se inyectan hasta que `consent.ads` es
  cierto. Si el visitante rechaza, no se descarga nada de Meta ni de TikTok.
- **Antes del consentimiento** se mide de forma agregada y no personal: no hay
  fan-out a plataformas publicitarias ni CAPI.
- **Revocar es tan fácil como aceptar** (`/privacy`). Si no lo fuera, el
  consentimiento nunca habría sido real.
- **Sin fingerprinting** de canvas, audio ni WebGL. Es legalmente hostil en la UE
  y no mejora la calidad del lead.

---

## 6. Rendimiento

Una web de medición que va lenta destruye justo lo que pretende medir.

- Un `ScrollTrigger` por bloque con `once: true`: cuando el reveal ha ocurrido no
  queda trabajo ligado al scroll, que es lo que mantiene el INP sano en una
  página tan larga.
- Lenis se mueve sobre el ticker de GSAP: **un solo bucle RAF**. Dos bucles es la
  causa habitual de que las secciones fijadas deriven al hacer scroll rápido.
- El colector de scroll trabaja dentro de `requestAnimationFrame` con guarda
  `ticking`, sobre listeners `passive`.
- Los eventos van por lotes; sólo las conversiones (peso ≥ 7) fuerzan un flush.
- `SplitText.revert()` en la limpieza: dejar el DOM partido rompe el re-render y
  el árbol de accesibilidad.
- `prefers-reduced-motion` está respetado en todos los componentes de motion.

---

## 7. Durabilidad de los leads

Un lead es el evento más caro del sitio. `src/lib/leads.ts` implementa:

1. Envío, con **un reintento** ante fallo de red o 5xx.
2. Si sigue fallando, el payload se **encola en localStorage** y se drena en la
   siguiente carga de página (`flushLeadQueue()` en el boot del provider).
3. Un 4xx **no se encola**: el payload es inválido y reintentarlo envenenaría la
   cola para siempre. Se le dice al visitante que corrija.
4. Los elementos de más de 7 días se descartan.

El visitante ve su informe en cualquiera de los casos, porque se calcula en
cliente con la misma función de scoring. Lo que nunca ocurre es que crea que ha
dejado su número y el equipo no lo reciba.

---

## 8. Modelo de datos

| Modelo | Rol |
|---|---|
| `Visitor` | Identidad conductual persistente. Atribución de primer toque inmutable, agregados denormalizados para que el dashboard no tenga que recorrer el stream. |
| `VisitSession` | Una visita continua; se cierra a los 30 min de inactividad. |
| `Event` | El stream crudo. `eventId` único = idempotencia. |
| `ScoreSnapshot` | Histórico con la causa de cada salto de banda. Permite demostrar *qué* comportamiento convirtió un WARM en HOT. |
| `Lead` | Captura con el perfil conductual **congelado** en `behaviorSnapshot`. Meses después se puede justificar por qué se calificó. |
| `ClientProfile` + `AssetConnection` | Onboarding de etapa 2 y accesos concedidos. |
| `Package` + `ClientPackage` | Capa comercial y MRR. |

La atribución de primer toque se escribe una vez y **nunca** se sobrescribe; la
de último toque se actualiza en cada visita. Tener las dos es lo que permite
discutir atribución con datos en lugar de con opiniones.
