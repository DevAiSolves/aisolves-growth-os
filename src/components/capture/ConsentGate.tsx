"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useTracking } from "@/components/providers/TrackingProvider";
import { brand } from "@/lib/brand";

/**
 * THE CONSENT GATE — fires after the first real scroll.
 *
 * Design intent: this is not a cookie banner. A banner asks for permission to
 * do something the visitor does not benefit from. This asks for an identity in
 * exchange for a personalised read of their own behaviour — the same trade the
 * end-of-scroll widget closes.
 *
 * Two paths, deliberately unequal:
 *   - Google login  -> identity resolved, hashed email available for CAPI
 *                      match quality, visitor enters the client onboarding.
 *   - Explicit accept -> consented but pseudonymous. Still fully trackable,
 *                      still retargetable, just a weaker match signal.
 *
 * Declining is always available and genuinely turns personalisation off.
 */

const SCROLL_TRIGGER_PCT = 12;
const SHOWN_KEY = "ais_gate_shown";

export function ConsentGate() {
  const { consent, grantConsent, declineConsent, track } = useTracking();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"google" | "accept" | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const armed = useRef(false);

  // --- trigger -------------------------------------------------------------
  useEffect(() => {
    if (consent.method) return; // decision already made
    if (sessionStorage.getItem(SHOWN_KEY)) return;

    const onScroll = () => {
      if (armed.current) return;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
      if (pct >= SCROLL_TRIGGER_PCT) {
        armed.current = true;
        sessionStorage.setItem(SHOWN_KEY, "1");
        // A short beat after the scroll settles reads as considered, not reflexive.
        setTimeout(() => {
          setOpen(true);
          track("identity.gate_shown", { triggerPct: Math.round(pct) });
        }, 550);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [consent.method, track]);

  // --- freeze the page behind the dialog ----------------------------------
  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
    if (open) { lenis?.stop(); document.body.style.overflow = "hidden"; }
    else { lenis?.start(); document.body.style.overflow = ""; }
    return () => { lenis?.start(); document.body.style.overflow = ""; };
  }, [open]);

  // --- focus trap + escape -------------------------------------------------
  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    const focusables = node?.querySelectorAll<HTMLElement>("button, a[href]");
    focusables?.[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { void handleDecline(); return; }
      if (e.key !== "Tab" || !focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleGoogle() {
    setBusy("google");
    await grantConsent("google_login");
    // Consent is persisted first so the decision survives the OAuth round-trip.
    await signIn("google", { callbackUrl: "/onboarding" });
  }

  async function handleAccept() {
    setBusy("accept");
    await grantConsent("explicit_accept");
    setOpen(false);
    setBusy(null);
  }

  async function handleDecline() {
    await declineConsent();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)", animation: "ticker-in 0.4s var(--ease-out-brand)" }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-[540px] overflow-hidden"
        style={{
          background: brand.color.ink,
          border: `1px solid ${brand.color.blue}`,
          borderRadius: "var(--radius-md)",
          animation: "ticker-in 0.55s var(--ease-out-brand)",
        }}
      >
        {/* brand bar */}
        <div style={{ height: 3, background: brand.color.blue }} />

        <div className="p-7 sm:p-9">
          <div className="t-mono mb-6 flex items-center justify-between opacity-60">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: brand.color.blue, animation: "pulse-ring 2s infinite" }}
              />
              Sistema de comportamiento activo
            </span>
            <span>01 / 02</span>
          </div>

          <h2 id="gate-title" className="t-h2 mb-4" style={{ color: brand.color.cream }}>
            Estás siendo <span className="serif-accent blue">leído</span>.
            <br />Podemos enseñarte cómo.
          </h2>

          <p className="t-body mb-6" style={{ color: "rgba(255,245,239,0.68)" }}>
            Desde que entraste medimos profundidad de scroll, tiempo real de atención por bloque,
            dudas y micro-intención. Autoriza la lectura personalizada y al final de la página te
            mostramos <strong style={{ color: brand.color.cream }}>tu propio informe conductual en vivo</strong>.
          </p>

          <ul className="mb-7 flex list-none flex-col gap-2 p-0 text-[12.5px]" style={{ color: "rgba(255,245,239,0.55)" }}>
            {[
              "Medimos comportamiento, nunca el contenido que escribes",
              "Puedes revocarlo en un clic desde el pie de página",
              "Cumple GDPR · Consent Mode v2 · datos de primera parte",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="blue mt-[3px] shrink-0">✦</span>{t}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleGoogle}
              disabled={busy !== null}
              data-track-cta="gate-google"
              className="btn"
              style={{
                background: brand.color.cream, color: brand.color.ink,
                justifyContent: "center", padding: "0.85rem 1.15rem", fontSize: "0.875rem",
                opacity: busy ? 0.6 : 1,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden style={{ position: "relative", zIndex: 1 }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.94v2.33A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.94a9 9 0 0 0 0 8.1l3.04-2.33Z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .94 4.95l3.04 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
              </svg>
              <span>{busy === "google" ? "Conectando…" : "Continuar con Google"}</span>
            </button>

            <button
              onClick={handleAccept}
              disabled={busy !== null}
              data-track-cta="gate-accept"
              className="btn btn-ghost"
              style={{ justifyContent: "center", padding: "0.85rem 1.15rem", fontSize: "0.875rem", opacity: busy ? 0.6 : 1 }}
            >
              <span>{busy === "accept" ? "Activando…" : "Aceptar y ver mi comportamiento"}</span>
            </button>

            <button
              onClick={handleDecline}
              data-track-cta="gate-decline"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,245,239,0.4)", fontSize: "0.75rem",
                padding: "0.55rem", fontFamily: "inherit",
              }}
            >
              Continuar sin seguimiento personalizado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
