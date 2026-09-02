# Motion 2026 — el sistema del dashboard

Tres capas progresivas. Cada una degrada a la de abajo, y la de abajo siempre
funciona. Todo vive en [`src/app/lab.css`](../src/app/lab.css).

---

## L3 · `animation-trigger` / `timeline-trigger`

**Lo más nuevo que existe.** Llega en **Chrome 145** (2026); a fecha de mayo de
2026 es Chrome/Edge únicamente.

Animación **disparada** por scroll, no *scrubbed*: la posición de scroll decide
**cuándo** arranca; después la animación corre con su propia duración y easing,
como cualquier animación CSS. Sustituye a `IntersectionObserver` por completo
para efectos de reveal.

```css
@supports (animation-trigger: view()) {
  .lab-row {
    animation: row-in 0.72s var(--ease-lab) both;
    animation-trigger: view() once;
    animation-trigger-range: entry 10% cover 30%;
  }
}
```

Aplicado a: filas de la tabla, columnas del histograma, odómetros.

---

## L2 · `animation-timeline: view()` — scroll-driven

**~82,6 % de soporte global. NO es Baseline**: Firefox sigue tras la flag
`layout.css.scroll-driven-animations.enabled` en la 152 (junio 2026), activada
solo en Nightly. Chrome 115+, Edge 115+, Safari 26, Opera 101+ sí.

Animación **scrubbed**: la barra se completa en proporción directa a la posición
de scroll. Es literalmente lo que pedía el brief — «barras que se completan
según el scroll».

```css
@supports (animation-timeline: view()) {
  .lab-bar__fill.is-scrolldriven {
    width: var(--fill-target);        /* correcto ya en el HTML de SSR */
    animation: bar-scrub linear both;
    animation-timeline: view();
    animation-range: entry 18% cover 46%;
  }
  @keyframes bar-scrub {
    from { clip-path: inset(0 100% 0 0); }
    to   { clip-path: inset(0 0 0 0); }
  }
}
```

**Detalle que importa:** el ancho final se escribe inline como `--fill-target`
durante el render de servidor. Así esta capa no necesita **nada** de JavaScript.
La primera implementación dependía de que JS escribiera el ancho, lo que
convertía la ruta "sin JS" en una ruta con JS — y dejaba las barras a cero
cuando la hidratación fallaba.

---

## L1 · `@property` — siempre disponible

Custom properties tipadas hacen animables gradientes, ángulos y números. El
anillo de score y los contadores no llevan ni una línea de `requestAnimationFrame`.

```css
@property --deg { syntax: "<angle>";      inherits: false; initial-value: 0deg; }
@property --num { syntax: "<integer>";    inherits: false; initial-value: 0; }

/* anillo cónico animado */
.score-ring {
  background: conic-gradient(var(--ring-color) var(--deg), transparent 0);
  transition: --deg 1.6s var(--ease-lab);
}

/* odómetro: cuenta hasta el valor, sin JS */
.odometer { counter-reset: n var(--num); animation: count-up 1.5s both; }
.odometer::after { content: counter(n); }
@keyframes count-up { from { --num: 0; } }
```

---

## Otras técnicas aplicadas

| Técnica | Dónde | Por qué |
|---|---|---|
| **View Transitions API** | Cambio de segmento paid↔organic | Los números **morfan** en vez de saltar: mantiene legible la comparación |
| **`linear()` spring** | `--spring` en rellenos y semáforo | Curva de muelle sin librería, corre en el compositor |
| **Variable font `wght` morph** | Semáforo | El estado 🔴 engorda la tipografía: jerarquía sin cambiar de color |
| **Heartbeat selectivo** | Solo el punto 🔴 | El movimiento **significa** algo: el ojo va a lo que está roto, no a la decoración |
| **Sheen sobre barra llena** | `::after` con `translateX` | Una barra llena sigue leyéndose viva; solo transform, sin repaint |
| **Trama diagonal para ⚫** | `.is-unmeasured` | Un hueco se ve **ausente**, no vacío. Vacío se lee como cero |
| **Scanline** | Cabecera | Un elemento, un transform: lee «instrumento», no «plantilla de dashboard» |
| **Ticker de eventos** | Marquee | Comunica «esto está midiendo ahora mismo» |

---

## Accesibilidad

`prefers-reduced-motion: reduce` desactiva **todas** las capas y deja los valores
finales visibles. Las barras conservan su ancho, el odómetro su número, el
semáforo su color. **El significado nunca depende del movimiento.**

Además existe una vista monoespaciada copiable (bloques `█░·`), que es la
especificación literal del brief y funciona sin CSS alguno.

---

## Fuentes

- [Scroll-driven animations — Web platform features explorer](https://web-platform-dx.github.io/web-features-explorer/features/scroll-driven-animations/)
- [CSS scroll-triggered animations are coming! — Chrome for Developers](https://developer.chrome.com/blog/scroll-triggered-animations)
- [`animation-timeline` — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline)
- [`animation-trigger` — CSS-Tricks Almanac](https://css-tricks.com/almanac/properties/a/animation-trigger/)
- [CSS Scroll-Triggered Animations are coming to Chrome — bram.us](https://www.bram.us/2025/12/12/css-scroll-triggered-animations-are-coming-to-chrome/)
