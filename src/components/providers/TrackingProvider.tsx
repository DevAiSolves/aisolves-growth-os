"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { tracker, type LiveProfile } from "@/lib/tracking/client";
import { installCollectors } from "@/lib/tracking/collectors";
import { readConsent, writeConsent } from "@/lib/tracking/consent";
import { bootPixels } from "@/lib/tracking/pixels";
import { isReturningVisitor } from "@/lib/tracking/fingerprint";
import { flushLeadQueue } from "@/lib/leads";
import type { ConsentState } from "@/lib/tracking/types";

interface Ctx {
  profile: LiveProfile | null;
  consent: ConsentState;
  anonId: string;
  track: typeof tracker.track;
  grantConsent: (method: "google_login" | "explicit_accept") => Promise<void>;
  declineConsent: () => Promise<void>;
}

const TrackingContext = createContext<Ctx | null>(null);

export const useTracking = () => {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error("useTracking must be used inside <TrackingProvider>");
  return ctx;
};

const PIXEL_IDS = {
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  ga4Id: process.env.NEXT_PUBLIC_GA4_ID,
  gtmId: process.env.NEXT_PUBLIC_GTM_ID,
  tiktokId: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
  linkedinId: process.env.NEXT_PUBLIC_LINKEDIN_ID,
};

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<LiveProfile | null>(null);
  const [consent, setConsent] = useState<ConsentState>(() => readConsent());
  const [anonId, setAnonId] = useState("");

  // Boot once.
  useEffect(() => {
    tracker.boot(PIXEL_IDS);
    setAnonId(tracker.anonId);
    const off = tracker.onProfile(setProfile);
    if (isReturningVisitor()) tracker.track("page.return_visit", {});
    // Deliver anything a previous visit could not send.
    void flushLeadQueue();
    return off;
  }, []);

  // Re-install collectors on every route change — new DOM, new instrumentation.
  useEffect(() => {
    tracker.track("page.view", {
      title: document.title,
      referrer: document.referrer || undefined,
    });
    const uninstall = installCollectors();
    return () => {
      tracker.track("page.exit", { path: pathname });
      uninstall();
    };
  }, [pathname]);

  // Load ad-tech only once consent allows it.
  useEffect(() => {
    if (consent.ads) bootPixels(PIXEL_IDS, consent);
  }, [consent]);

  const persist = useCallback(async (next: ConsentState) => {
    setConsent(next);
    tracker.consent = next;
    await fetch("/api/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonId: tracker.anonId,
        granted: next.granted,
        analytics: next.analytics,
        ads: next.ads,
        personalization: next.personalization,
        method: next.method,
      }),
    }).catch(() => {});
  }, []);

  const grantConsent = useCallback(async (method: "google_login" | "explicit_accept") => {
    const next = writeConsent({
      granted: true, analytics: true, ads: true, personalization: true, method,
    });
    tracker.track("identity.consent_granted", { method });
    if (method === "google_login") tracker.track("identity.google_login", {});
    await persist(next);
  }, [persist]);

  const declineConsent = useCallback(async () => {
    const next = writeConsent({
      granted: false, analytics: false, ads: false, personalization: false, method: "declined",
    });
    tracker.track("identity.consent_declined", {});
    await persist(next);
  }, [persist]);

  return (
    <TrackingContext.Provider
      value={{
        profile, consent, anonId,
        track: tracker.track.bind(tracker),
        grantConsent, declineConsent,
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
}
