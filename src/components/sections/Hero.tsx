"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { brand } from "@/lib/brand";
import { Section } from "@/components/site/Section";
import { useTracking } from "@/components/providers/TrackingProvider";

/**
 * The home hero is the behavioural instrument, not decoration.
 * The orbit reacts to the visitor's own live score, so the first thing they
 * see reacting to them is the product itself.
 */
export function Hero() {
  const { profile } = useTracking();
  const headline = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reduced motion must reveal EVERY animated target, not just the ones that
    // move. `.hero-word` carries an inline opacity:0 that only the timeline
    // clears — missing it here left the H1 invisible for anyone with the OS
    // preference on, which is the exact opposite of an accessibility path.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(".hero-word", { opacity: 1, yPercent: 0 });
      gsap.set(".hero-anim", { opacity: 1, y: 0 });
      gsap.set(".orbit-ring", { opacity: 1, scale: 1 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.timeline({ defaults: { ease: "expo.out" } })
        .fromTo(".hero-word", { yPercent: 118, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 1.25, stagger: 0.075 }, 0.15)
        .fromTo(".hero-anim", { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, stagger: 0.09 }, 0.55)
        .fromTo(".orbit-ring", { scale: 0.72, opacity: 0 },
          { scale: 1, opacity: 1, duration: 1.6, stagger: 0.11 }, 0.35);
    }, headline);
    return () => ctx.revert();
  }, []);

  return (
    <Section id="hero" order={1} theme="dark" className="pt-[130px] pb-20 lg:pt-[168px] lg:pb-28">
      <div ref={headline} className="relative">
        <span className="tick" style={{ top: -18, left: -4 }} aria-hidden />

        {/* --- headline --- */}
        <h1 className="t-display m-0" aria-label="Comportamiento convertido en ingresos">
          {[
            <>Comportamiento</>,
            <><span className="serif-accent blue">convertido</span> en</>,
            <>ingresos.</>,
          ].map((line, i) => (
            <span key={i} className="line-mask">
              <span className="hero-word block" style={{ opacity: 0 }}>{line}</span>
            </span>
          ))}
        </h1>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-end">
          <div>
            <p className="t-h3 hero-anim mb-5 max-w-[26ch]" style={{ opacity: 0 }}>
              No vendemos anuncios. Instalamos el sistema que{" "}
              <span className="serif-accent">lee a cada visitante</span> y decide
              quién merece una llamada.
            </p>
            <p className="t-body hero-anim mb-8 max-w-[52ch] opacity-65" style={{ opacity: 0 }}>
              Cada scroll, cada duda de 8 segundos frente a un precio y cada corrección
              en un formulario se convierte en dato. Puntuamos el comportamiento en
              tiempo real, lo enviamos a Meta y Google por servidor —sin perder señal
              por bloqueadores— y activamos el canal correcto en el momento correcto.
            </p>
            <div className="hero-anim flex flex-wrap gap-3" style={{ opacity: 0 }}>
              <a href={`https://wa.me/${brand.whatsapp}`} target="_blank" rel="noopener noreferrer"
                data-track-cta="hero-primary" className="btn btn-primary">
                <span>Auditoría de tracking gratuita</span>
              </a>
              <a href="#engine" data-track-cta="hero-secondary" className="btn btn-ghost">
                <span>Ver el sistema ↓</span>
              </a>
            </div>
          </div>

          {/* --- live orbit --- */}
          <div className="hero-anim relative aspect-square w-full max-w-[420px] justify-self-end" style={{ opacity: 0 }}>
            <Orbit score={profile?.score ?? 0} />
          </div>
        </div>

        {/* --- live strip: proof that the system is already running --- */}
        <div className="hairline-t mt-16 grid grid-cols-2 gap-px pt-0 md:grid-cols-4"
          style={{ background: "var(--line)" }}>
          {[
            { k: "Señales capturadas", v: profile?.eventCount ?? 0, live: true },
            { k: "Atención real", v: `${Math.round((profile?.activeMs ?? 0) / 1000)}s`, live: true },
            { k: "Profundidad", v: `${profile?.maxScroll ?? 0}%`, live: true },
            { k: "Tu estado", v: profile?.temperature ?? "COLD", live: true },
          ].map((m) => (
            <div key={m.k} className="p-5" style={{ background: brand.color.ink }}>
              <p className="t-mono mb-2 flex items-center gap-1.5 opacity-45">
                {m.live && <span className="inline-block h-1 w-1 rounded-full" style={{ background: brand.color.blue }} />}
                {m.k}
              </p>
              <p className="t-h3 blue tabular-nums">{m.v}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/** Concentric rings — the outer ring fills in proportion to the live score. */
function Orbit({ score }: { score: number }) {
  const R = 150;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="core" cx="50%" cy="50%">
          <stop offset="0%" stopColor={brand.color.blue} stopOpacity="0.85" />
          <stop offset="100%" stopColor={brand.color.blue} stopOpacity="0" />
        </radialGradient>
      </defs>

      {[190, 150, 112, 74].map((r, i) => (
        <ellipse
          key={r} className="orbit-ring"
          cx="200" cy="200" rx={r} ry={r * 0.42}
          fill="none" stroke={brand.color.hairline} strokeWidth="1"
          opacity={0.45 - i * 0.06}
          style={{
            transformOrigin: "200px 200px",
            animation: `orbit-spin ${34 + i * 11}s linear infinite ${i % 2 ? "reverse" : ""}`,
          }}
        />
      ))}

      {/* score arc */}
      <circle
        cx="200" cy="200" r={R}
        fill="none" stroke={brand.color.blue} strokeWidth="1.5"
        strokeDasharray={C} strokeDashoffset={C - (C * Math.min(score, 100)) / 100}
        strokeLinecap="round" transform="rotate(-90 200 200)"
        style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)" }}
      />

      <circle cx="200" cy="200" r="66" fill="url(#core)" />
      <path d="M200 174l11 26 26 11-26 11-11 26-11-26-26-11 26-11 11-26Z" fill={brand.color.cream} />

      {[
        { x: 350, y: 200, label: "META" },
        { x: 200, y: 45,  label: "GOOGLE" },
        { x: 52,  y: 210, label: "WHATSAPP" },
        { x: 214, y: 358, label: "CRM" },
      ].map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy={n.y} r="3" fill={brand.color.blue} />
          <text x={n.x + 9} y={n.y + 4} fill={brand.color.hairline}
            fontSize="9" letterSpacing="1.6" fontFamily="ui-monospace, monospace">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
