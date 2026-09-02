/**
 * AUTO-INSTRUMENTATION
 * ---------------------------------------------------------------------------
 * Declarative. Any markup can opt in with data attributes — no per-component
 * tracking code, so designers can restructure the page without breaking
 * measurement:
 *
 *   data-track-section="packages"      -> enter/exit/dwell/revisit
 *   data-track-block="tier-scale"      -> enter/dwell/hover
 *   data-track-cta="hero-primary"      -> view/hover/click
 *   data-track-form="whatsapp-widget"  -> field-level behavioural metadata
 *   data-track-video="manifesto"       -> start/50%/complete
 *   data-track-expand="faq-3"          -> accordion opens
 *
 * PRIVACY: form collectors read length, validity, timing and correction counts.
 * They never read, transmit or store the typed value.
 */

import { tracker } from "./client";
import { SURVIVAL_BUCKETS, QUALITY_VISIT, BOUNCE, OFFER_SECTION } from "./taxonomy";

type Cleanup = () => void;

export function installCollectors(): Cleanup {
  const cleanups: Cleanup[] = [
    scrollCollector(),
    sectionCollector(),
    blockCollector(),
    ctaCollector(),
    formCollector(),
    videoCollector(),
    frictionCollector(),
    expandCollector(),
    activityCollector(),
    survivalCollector(),
    qualityCollector(),
    visibilityCollector(),
    errorCollector(),
  ];
  return () => cleanups.forEach((c) => c());
}

// ---------------------------------------------------------------------------
// SCROLL — depth milestones, reading velocity, backtracking
// ---------------------------------------------------------------------------
function scrollCollector(): Cleanup {
  let ticking = false;
  let lastY = window.scrollY;
  let lastT = performance.now();
  let slowRun = 0;
  let peak = 0;
  const pageStart = performance.now();

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const pct = h > 0 ? Math.min(100, Math.round((y / h) * 100)) : 0;
      tracker.reportScroll(pct);

      // Every milestone carries the ms it took to reach it. Depth without
      // timing cannot tell a reader from someone who flung the scrollbar.
      for (const m of [25, 50, 75, 90, 100] as const) {
        if (pct >= m) {
          const msToReach = Math.round(performance.now() - pageStart);
          tracker.track(`scroll.depth_${m}`, { pct, msToReach });
          tracker.recordScrollTiming(m, msToReach);
        }
      }

      const now = performance.now();
      const dt = now - lastT;
      const dy = y - lastY;
      if (dt > 0) {
        const vel = Math.abs(dy) / dt; // px/ms
        // Sustained slow forward scroll over ~3s = genuine reading.
        if (vel < 0.35 && dy > 0) {
          slowRun += dt;
          if (slowRun > 3000) {
            tracker.track("scroll.velocity_slow", { velocity: +vel.toFixed(3), pct });
            slowRun = 0;
          }
        } else slowRun = 0;

        // Meaningful upward move after having gone deeper = re-reading.
        if (dy < -300 && peak - pct > 8) {
          tracker.track("scroll.backtrack", { fromPct: peak, toPct: pct, deltaPx: Math.abs(dy) });
          peak = pct;
        }
      }
      if (pct > peak) peak = pct;
      lastY = y; lastT = now;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

// ---------------------------------------------------------------------------
// SECTIONS — enter / exit / dwell / revisit with visibility quality
// ---------------------------------------------------------------------------
function sectionCollector(): Cleanup {
  const state = new Map<string, {
    enteredAt: number; visits: number; totalMs: number; maxRatio: number; dwellFired: boolean;
  }>();

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        const id = el.dataset.trackSection!;
        const s = state.get(id) ?? { enteredAt: 0, visits: 0, totalMs: 0, maxRatio: 0, dwellFired: false };
        s.maxRatio = Math.max(s.maxRatio, e.intersectionRatio);

        if (e.isIntersecting && e.intersectionRatio >= 0.5 && !s.enteredAt) {
          s.enteredAt = performance.now();
          s.visits++;
          state.set(id, s);
          tracker.track(s.visits > 1 ? "section.revisit" : "section.enter",
            { visits: s.visits, ratio: +e.intersectionRatio.toFixed(2), order: el.dataset.trackOrder },
            { sectionId: id });
        } else if ((!e.isIntersecting || e.intersectionRatio < 0.5) && s.enteredAt) {
          const dwellMs = Math.round(performance.now() - s.enteredAt);
          s.totalMs += dwellMs;
          s.enteredAt = 0;
          state.set(id, s);
          tracker.track("section.exit",
            { dwellMs, totalMs: s.totalMs, maxRatio: +s.maxRatio.toFixed(2), visits: s.visits },
            { sectionId: id });

          if (s.totalMs >= tracker.sectionThreshold(id) && !s.dwellFired) {
            s.dwellFired = true;
            tracker.track("section.dwell",
              { dwellMs: s.totalMs, visits: s.visits, quality: s.maxRatio >= 0.9 ? "full" : "partial" },
              { sectionId: id });
          }
        }
      }
    },
    { threshold: [0, 0.25, 0.5, 0.75, 0.9, 1] }
  );

  // While a section is held, fire dwell as soon as the threshold is crossed —
  // don't wait for the exit, or a visitor who converts mid-section is missed.
  const poll = setInterval(() => {
    const now = performance.now();
    state.forEach((s, id) => {
      if (!s.enteredAt || s.dwellFired) return;
      const live = s.totalMs + (now - s.enteredAt);
      if (live >= tracker.sectionThreshold(id)) {
        s.dwellFired = true;
        tracker.track("section.dwell",
          { dwellMs: Math.round(live), visits: s.visits, quality: "live" },
          { sectionId: id });
      }
    });
  }, 1000);

  document.querySelectorAll<HTMLElement>("[data-track-section]").forEach((el) => io.observe(el));
  return () => { io.disconnect(); clearInterval(poll); };
}

// ---------------------------------------------------------------------------
// BLOCKS — the granular layer. Cards, pricing tiers, FAQ rows, list items.
// ---------------------------------------------------------------------------
function blockCollector(): Cleanup {
  const seen = new Map<string, number>();
  const hoverTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      const id = el.dataset.trackBlock!;
      const sectionId = el.closest<HTMLElement>("[data-track-section]")?.dataset.trackSection;
      if (e.isIntersecting && e.intersectionRatio >= 0.6) {
        if (!seen.has(id)) {
          seen.set(id, performance.now());
          tracker.track("block.enter",
            { position: Math.round(el.getBoundingClientRect().top), ratio: +e.intersectionRatio.toFixed(2) },
            { sectionId, blockId: id });
        }
      } else if (seen.has(id)) {
        const dwellMs = Math.round(performance.now() - seen.get(id)!);
        seen.delete(id);
        if (dwellMs > 1200) {
          tracker.track("block.dwell", { dwellMs }, { sectionId, blockId: id });
        }
      }
    }
  }, { threshold: [0, 0.6, 1] });

  const onEnter = (ev: Event) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-track-block]");
    if (!el) return;
    hoverTimers.set(el, setTimeout(() => {
      tracker.track("block.hover", { sustainedMs: 600 }, {
        blockId: el.dataset.trackBlock,
        sectionId: el.closest<HTMLElement>("[data-track-section]")?.dataset.trackSection,
      });
    }, 600));
  };
  const onLeave = (ev: Event) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-track-block]");
    if (el && hoverTimers.has(el)) { clearTimeout(hoverTimers.get(el)!); hoverTimers.delete(el); }
  };

  document.querySelectorAll<HTMLElement>("[data-track-block]").forEach((el) => {
    io.observe(el);
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
  });

  return () => {
    io.disconnect();
    document.querySelectorAll<HTMLElement>("[data-track-block]").forEach((el) => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    });
  };
}

// ---------------------------------------------------------------------------
// CTA — view, hesitation hover, click
// ---------------------------------------------------------------------------
function ctaCollector(): Cleanup {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      tracker.track("cta.view", { label: el.textContent?.trim().slice(0, 60) },
        { elementId: el.dataset.trackCta, sectionId: el.closest<HTMLElement>("[data-track-section]")?.dataset.trackSection });
      io.unobserve(el);
    }
  }, { threshold: 0.8 });

  const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
  const hoverIn = (ev: Event) => {
    const el = (ev.currentTarget as HTMLElement);
    timers.set(el, setTimeout(() => {
      tracker.track("cta.hover", { label: el.textContent?.trim().slice(0, 60) },
        { elementId: el.dataset.trackCta });
    }, 500));
  };
  const hoverOut = (ev: Event) => {
    const el = ev.currentTarget as HTMLElement;
    const t = timers.get(el); if (t) clearTimeout(t);
  };
  const click = (ev: Event) => {
    const el = ev.currentTarget as HTMLElement;
    const isWa = (el.getAttribute("href") ?? "").includes("wa.me") || el.dataset.trackCta?.includes("whatsapp");
    tracker.track(isWa ? "cta.whatsapp_click" : "cta.click", {
      label: el.textContent?.trim().slice(0, 60),
      href: el.getAttribute("href") ?? undefined,
      scrollPct: tracker.maxScroll,
    }, {
      elementId: el.dataset.trackCta,
      sectionId: el.closest<HTMLElement>("[data-track-section]")?.dataset.trackSection,
    });
  };

  const els = document.querySelectorAll<HTMLElement>("[data-track-cta]");
  els.forEach((el) => {
    io.observe(el);
    el.addEventListener("mouseenter", hoverIn);
    el.addEventListener("mouseleave", hoverOut);
    el.addEventListener("click", click);
  });

  return () => {
    io.disconnect();
    els.forEach((el) => {
      el.removeEventListener("mouseenter", hoverIn);
      el.removeEventListener("mouseleave", hoverOut);
      el.removeEventListener("click", click);
    });
  };
}

// ---------------------------------------------------------------------------
// FORMS — behavioural metadata only, never values
// ---------------------------------------------------------------------------
function formCollector(): Cleanup {
  const forms = document.querySelectorAll<HTMLFormElement>("[data-track-form]");
  const cleanups: Cleanup[] = [];

  forms.forEach((form) => {
    const formId = form.dataset.trackForm!;
    let started = false;
    let submitted = false;
    let formStart = 0;
    const fieldState = new Map<string, { focusAt: number; corrections: number; hesitated: boolean }>();
    let hesitationTimer: ReturnType<typeof setTimeout> | null = null;

    const fields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select"
    )).filter((f) => f.type !== "hidden");

    fields.forEach((field, index) => {
      const name = field.name || field.id || `field_${index}`;

      const onFocus = () => {
        if (!started) {
          started = true;
          formStart = performance.now();
          tracker.track("form.start", { formId, fields: fields.length }, { elementId: formId });
        }
        fieldState.set(name, { focusAt: performance.now(), corrections: 0, hesitated: false });
        tracker.track("form.field_focus", {
          formId, field: name, index,
          timeToReachMs: Math.round(performance.now() - formStart),
        }, { elementId: formId });

        hesitationTimer = setTimeout(() => {
          const s = fieldState.get(name);
          if (s && !s.hesitated && !field.value) {
            s.hesitated = true;
            tracker.track("form.hesitation", { formId, field: name, index, afterMs: 8000 }, { elementId: formId });
          }
        }, 8000);
      };

      const onBlur = () => {
        if (hesitationTimer) clearTimeout(hesitationTimer);
        const s = fieldState.get(name);
        if (!s) return;
        const fillMs = Math.round(performance.now() - s.focusAt);
        const value = "value" in field ? String(field.value) : "";
        const valid = field.checkValidity();

        // METADATA ONLY. `value` is measured, never sent.
        const payload = {
          formId, field: name, index, fillMs,
          length: value.length,
          filled: value.length > 0,
          valid,
          corrections: s.corrections,
          /* eslint-disable-next-line */
          charsPerSecond: fillMs > 0 ? +(value.length / (fillMs / 1000)).toFixed(2) : 0,
        };
        tracker.track(valid && value ? "form.field_complete" : value ? "form.field_error" : "form.field_focus",
          payload, { elementId: formId });
      };

      const onKey = (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === "Backspace" || ke.key === "Delete") {
          const s = fieldState.get(name); if (s) s.corrections++;
        }
        tracker.markInput();
      };
      const onPaste = () => {
        tracker.track("form.field_complete", { formId, field: name, index, pasted: true }, { elementId: formId });
      };

      field.addEventListener("focus", onFocus);
      field.addEventListener("blur", onBlur);
      field.addEventListener("keydown", onKey);
      field.addEventListener("paste", onPaste);
      cleanups.push(() => {
        field.removeEventListener("focus", onFocus);
        field.removeEventListener("blur", onBlur);
        field.removeEventListener("keydown", onKey);
        field.removeEventListener("paste", onPaste);
      });
    });

    const onSubmit = () => {
      submitted = true;
      tracker.track("form.submit", {
        formId,
        totalMs: Math.round(performance.now() - formStart),
        fields: fields.length,
      }, { elementId: formId });
    };
    form.addEventListener("submit", onSubmit);

    const onUnload = () => {
      if (started && !submitted) {
        const lastField = [...fieldState.entries()].pop()?.[0];
        // Name the exact field that killed the form instead of guessing later.
        const lastIndex = fields.findIndex((f) => (f.name || f.id) === lastField);
        tracker.track("form.field_drop", {
          formId, field: lastField, index: lastIndex,
          filledBefore: fields.filter((f, i) => i < lastIndex && "value" in f && f.value).length,
        }, { elementId: formId });
        tracker.track("form.abandon", {
          formId, lastField,
          filledCount: fields.filter((f) => "value" in f && f.value).length,
          totalFields: fields.length,
        }, { elementId: formId });
      }
    };
    window.addEventListener("pagehide", onUnload);

    cleanups.push(() => {
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("pagehide", onUnload);
    });
  });

  return () => cleanups.forEach((c) => c());
}

// ---------------------------------------------------------------------------
function videoCollector(): Cleanup {
  const vids = document.querySelectorAll<HTMLVideoElement>("[data-track-video]");
  const cleanups: Cleanup[] = [];
  vids.forEach((v) => {
    const id = v.dataset.trackVideo!;
    let half = false;
    const onPlay = () => tracker.track("video.start", { videoId: id }, { elementId: id });
    const onTime = () => {
      if (!half && v.duration && v.currentTime / v.duration >= 0.5) {
        half = true;
        tracker.track("video.progress_50", { videoId: id, seconds: Math.round(v.currentTime) }, { elementId: id });
      }
    };
    const onEnd = () => tracker.track("video.complete", { videoId: id, duration: Math.round(v.duration || 0) }, { elementId: id });
    v.addEventListener("play", onPlay);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    cleanups.push(() => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnd);
    });
  });
  return () => cleanups.forEach((c) => c());
}

// ---------------------------------------------------------------------------
function expandCollector(): Cleanup {
  const onClick = (ev: Event) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-track-expand]");
    if (!el) return;
    tracker.track("block.expand", {
      label: el.dataset.trackExpandLabel ?? el.textContent?.trim().slice(0, 80),
    }, {
      blockId: el.dataset.trackExpand,
      sectionId: el.closest<HTMLElement>("[data-track-section]")?.dataset.trackSection,
    });
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}

// ---------------------------------------------------------------------------
// FRICTION — rage clicks, dead clicks, exit intent
// ---------------------------------------------------------------------------
function frictionCollector(): Cleanup {
  let clicks: { t: number; x: number; y: number; el: EventTarget | null }[] = [];

  const onClick = (ev: MouseEvent) => {
    const now = Date.now();
    clicks = clicks.filter((c) => now - c.t < 1000);
    clicks.push({ t: now, x: ev.clientX, y: ev.clientY, el: ev.target });

    const near = clicks.filter((c) => Math.abs(c.x - ev.clientX) < 30 && Math.abs(c.y - ev.clientY) < 30);
    if (near.length >= 3) {
      const el = ev.target as HTMLElement;
      tracker.track("friction.rage_click", {
        count: near.length,
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().slice(0, 40),
        path: cssPath(el),
      });
      clicks = [];
    }

    const el = ev.target as HTMLElement;
    const interactive = el.closest("a,button,input,select,textarea,label,[role=button],[data-track-cta],[data-track-expand]");
    if (!interactive) {
      tracker.track("friction.dead_click", { tag: el.tagName.toLowerCase(), path: cssPath(el) });
    }
  };

  let exitFired = false;
  const onMouseOut = (ev: MouseEvent) => {
    if (exitFired || ev.clientY > 8 || ev.relatedTarget) return;
    exitFired = true;
    tracker.track("friction.exit_intent", { scrollPct: tracker.maxScroll });
    setTimeout(() => { exitFired = false; }, 30000);
  };

  document.addEventListener("click", onClick, true);
  document.addEventListener("mouseout", onMouseOut);
  return () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("mouseout", onMouseOut);
  };
}

function activityCollector(): Cleanup {
  // Scrolling and mouse movement keep the active clock alive but do NOT count
  // as interaction — otherwise every bounce would look engaged.
  const passiveEvents = ["mousemove", "scroll", "touchmove"];
  const deliberateEvents = ["keydown", "click", "touchstart"];
  const passive = () => tracker.markInput(false);
  const deliberate = () => tracker.markInput(true);
  const opts = { passive: true } as const;

  passiveEvents.forEach((e) => window.addEventListener(e, passive, opts));
  deliberateEvents.forEach((e) => window.addEventListener(e, deliberate, opts));
  return () => {
    passiveEvents.forEach((e) => window.removeEventListener(e, passive));
    deliberateEvents.forEach((e) => window.removeEventListener(e, deliberate));
  };
}

function cssPath(el: HTMLElement): string {
  const parts: string[] = [];
  let node: HTMLElement | null = el;
  let depth = 0;
  while (node && depth < 4) {
    let s = node.tagName.toLowerCase();
    if (node.id) { s += `#${node.id}`; parts.unshift(s); break; }
    const cls = (node.className || "").toString().split(/\s+/).filter(Boolean)[0];
    if (cls) s += `.${cls}`;
    parts.unshift(s);
    node = node.parentElement;
    depth++;
  }
  return parts.join(">").slice(0, 120);
}


// ---------------------------------------------------------------------------
// SURVIVAL — active-time buckets.
//
// This is the dimension Ads Manager cannot see. A "click" that leaves at 1.2s
// and one that reads for 45s are identical in the ad platform and completely
// different humans. Buckets are measured on ACTIVE time, so a tab left open in
// the background never inflates them.
// ---------------------------------------------------------------------------
function survivalCollector(): Cleanup {
  const fired = new Set<string>();
  const id = setInterval(() => {
    const active = tracker.activeMsNow();
    for (const b of SURVIVAL_BUCKETS) {
      if (active >= b.ms && !fired.has(b.event)) {
        fired.add(b.event);
        tracker.track(b.event, { activeMs: Math.round(active), thresholdMs: b.ms });
      }
    }
  }, 500);
  return () => clearInterval(id);
}

// ---------------------------------------------------------------------------
// QUALITY VISIT — active time AND scroll depth. Both conditions, never either.
//
// This is the only mid-funnel event worth giving Meta as an optimisation
// target: it cannot be faked by a fast scroll or by an idle tab.
// ---------------------------------------------------------------------------
function qualityCollector(): Cleanup {
  let qualityFired = false;
  let offerFired = false;

  const id = setInterval(() => {
    if (!qualityFired) {
      const active = tracker.activeMsNow();
      if (active >= QUALITY_VISIT.minActiveMs && tracker.maxScroll >= QUALITY_VISIT.minScrollPct) {
        qualityFired = true;
        tracker.track("quality.visit", {
          activeMs: Math.round(active),
          scrollPct: tracker.maxScroll,
          msToQualify: Math.round(performance.now()),
        });
      }
    }
    // A real ViewContent: sustained dwell on the offer itself.
    if (!offerFired) {
      const dwell = tracker.sectionDwell[OFFER_SECTION] ?? 0;
      if (dwell >= tracker.sectionThreshold(OFFER_SECTION)) {
        offerFired = true;
        tracker.track("quality.offer_viewed", { dwellMs: dwell, section: OFFER_SECTION },
          { sectionId: OFFER_SECTION });
      }
    }
  }, 1000);

  // Bounce is only knowable at exit.
  const onExit = () => {
    const active = tracker.activeMsNow();
    if (active <= BOUNCE.maxActiveMs && tracker.maxScroll <= BOUNCE.maxScrollPct && !tracker.hasInteracted) {
      tracker.track("quality.bounce", {
        activeMs: Math.round(active), scrollPct: tracker.maxScroll,
      });
    }
  };
  window.addEventListener("pagehide", onExit);

  return () => { clearInterval(id); window.removeEventListener("pagehide", onExit); };
}

// ---------------------------------------------------------------------------
function visibilityCollector(): Cleanup {
  let hiddenAt = 0;
  const onChange = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = performance.now();
    } else if (hiddenAt) {
      tracker.track("friction.tab_hidden", { awayMs: Math.round(performance.now() - hiddenAt) });
      hiddenAt = 0;
    }
  };
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

// ---------------------------------------------------------------------------
// JS ERRORS — a broken page cannot convert, and this is usually the reason a
// section's conversion rate collapses on one browser only.
// ---------------------------------------------------------------------------
function errorCollector(): Cleanup {
  let count = 0;
  const cap = 5; // never let an error loop flood the collector

  const onError = (e: ErrorEvent) => {
    if (count++ >= cap) return;
    tracker.track("friction.js_error", {
      message: String(e.message).slice(0, 160),
      source: String(e.filename ?? "").slice(0, 120),
      line: e.lineno, col: e.colno,
      scrollPct: tracker.maxScroll,
    });
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    if (count++ >= cap) return;
    tracker.track("friction.js_error", {
      message: String(e.reason?.message ?? e.reason).slice(0, 160),
      kind: "unhandledrejection",
    });
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
