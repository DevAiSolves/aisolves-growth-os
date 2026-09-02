"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type Props = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
  y?: number;
  stagger?: number;
  /** Reveal direct children one after another instead of the block as a whole. */
  staggerChildren?: boolean;
};

/**
 * The workhorse scroll reveal. One ScrollTrigger per block, `once: true`, so
 * there is no scroll-linked work left running after the element has played —
 * this is what keeps INP healthy on a page this long.
 */
export function Reveal({
  children, as: Tag = "div", className = "",
  delay = 0, y = 28, stagger = 0.07, staggerChildren = false,
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);

    // The wrapper always carries an inline opacity:0 so there is no flash
    // before hydration. Whatever happens next, it must be cleared — in
    // stagger mode the animation targets the CHILDREN, so forgetting the
    // wrapper would leave the whole block invisible.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { opacity: 1, y: 0 });
      if (staggerChildren) gsap.set(el.children, { opacity: 1, y: 0 });
      return;
    }

    const targets = staggerChildren ? Array.from(el.children) : el;
    if (staggerChildren) gsap.set(el, { opacity: 1 });
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y },
        {
          opacity: 1, y: 0,
          duration: 0.9, delay,
          ease: "power3.out",
          stagger: staggerChildren ? stagger : 0,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }
      );
    }, el);

    return () => ctx.revert();
  }, [delay, y, stagger, staggerChildren]);

  return (
    <Tag ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </Tag>
  );
}
