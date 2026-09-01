"use client";

import { useState } from "react";
import { useTracking } from "@/components/providers/TrackingProvider";
import { brand } from "@/lib/brand";

/** Revoking must be as easy as granting, or the consent was never real. */
export function PrivacyControls() {
  const { consent, grantConsent, declineConsent, profile, anonId } = useTracking();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="card mt-16 p-8">
      <p className="t-mono blue mb-4">Tus controles</p>
      <h2 className="t-h2 mb-3" style={{ fontSize: "1.5rem" }}>
        Estado actual: {consent.granted ? "seguimiento personalizado activo" : "sin seguimiento personalizado"}
      </h2>
      <p className="t-body mb-6 max-w-[62ch] opacity-65">
        Identificador anónimo: <code style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.85em" }}>{anonId.slice(0, 8)}…</code>
        {profile && <> · Score conductual actual: <strong className="blue">{profile.score}/100</strong> · {profile.eventCount} señales.</>}
      </p>

      <div className="flex flex-wrap gap-3">
        {consent.granted ? (
          <button
            onClick={async () => { await declineConsent(); setMsg("Consentimiento revocado. La medición vuelve a ser agregada y anónima."); }}
            data-track-cta="privacy-revoke" className="btn btn-ghost"
          >
            <span>Revocar consentimiento</span>
          </button>
        ) : (
          <button
            onClick={async () => { await grantConsent("explicit_accept"); setMsg("Consentimiento activado."); }}
            data-track-cta="privacy-grant" className="btn btn-primary"
          >
            <span>Activar seguimiento personalizado</span>
          </button>
        )}
        <a href={`mailto:${brand.email}?subject=${encodeURIComponent("Solicitud RGPD — acceso / supresión de datos")}`}
          data-track-cta="privacy-gdpr" className="btn btn-ghost">
          <span>Solicitar acceso o supresión</span>
        </a>
      </div>

      {msg && <p className="t-body blue mt-5">{msg}</p>}
    </div>
  );
}
