"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

/**
 * Line-by-line masked reveal for display headlines.
 *
 * Two details that matter:
 *  1. `revert()` on cleanup — SplitText rewrites the DOM, and leaving it split
 *     breaks re-rendering and screen readers.
 *  2. The original text stays in the accessibility tree via aria-label, so the
 *     effect never costs us the heading's semantics.
 */
export function SplitReveal({
  children, className = "", as: Tag = "h2", delay = 0, label,
}: {
  /** Inline markup is allowed — SplitText re-wraps by rendered line, not by node. */
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "div";
  delay?: number;
  /** Accessible name. Defaults to the element's own text content. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger, SplitText);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { opacity: 1 });
      return;
    }

    let split: SplitText | null = null;
    const ctx = gsap.context(() => {
      split = new SplitText(el, { type: "lines", linesClass: "split-line-inner" });
      gsap.set(el, { opacity: 1 });
      gsap.set(split.lines, { yPercent: 110 });
      gsap.to(split.lines, {
        yPercent: 0,
        duration: 1.05,
        delay,
        ease: "expo.out",
        stagger: 0.08,
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
      });
    }, el);

    return () => { split?.revert(); ctx.revert(); };
  }, [delay, children]);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={className}
      aria-label={label}
      style={{ opacity: 0, overflow: "hidden", paddingBottom: "0.1em" }}
    >
      {children}
    </Tag>
  );
}
