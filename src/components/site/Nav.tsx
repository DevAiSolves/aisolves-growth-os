"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { brand } from "@/lib/brand";

const links = [
  { href: "/#engine", label: "El Sistema" },
  { href: "/services", label: "Servicios" },
  { href: "/method", label: "Método" },
  { href: "/#packages", label: "Paquetes" },
  { href: "/#team", label: "Equipo" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? "rgba(0,0,0,0.72)" : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        borderBottom: scrolled ? "1px solid var(--line)" : "1px solid transparent",
      }}
    >
      <nav className="shell flex h-[68px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline" style={{ color: "var(--color-cream)" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M2 18L10 2l8 16-8-5.2L2 18Z" fill="currentColor" />
          </svg>
          <span className="text-[15px] font-semibold tracking-[-0.04em]">{brand.name}</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              data-track-cta={`nav-${l.label.toLowerCase().replace(/\s/g, "-")}`}
              className="text-[13px] no-underline opacity-70 transition-opacity hover:opacity-100"
              style={{ color: "var(--color-cream)" }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            data-track-cta="nav-dashboard"
            className="hidden text-[13px] no-underline opacity-70 hover:opacity-100 sm:block"
            style={{ color: "var(--color-cream)" }}
          >
            Dashboard
          </Link>
          <a
            href={`https://wa.me/${brand.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            data-track-cta="nav-whatsapp"
            className="btn btn-primary"
          >
            <span>Hablar con un experto</span>
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menú"
            aria-expanded={open}
            className="md:hidden"
            style={{ background: "none", border: "none", color: "var(--color-cream)", cursor: "pointer" }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
              <path d={open ? "M5 5l12 12M17 5L5 17" : "M3 7h16M3 15h16"} stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="shell flex flex-col gap-4 pb-6 md:hidden" style={{ borderTop: "1px solid var(--line)", paddingTop: 20 }}>
          {links.map((l) => (
            <Link
              key={l.href} href={l.href} onClick={() => setOpen(false)}
              data-track-cta={`navmob-${l.label}`}
              className="t-h3 no-underline" style={{ color: "var(--color-cream)" }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
