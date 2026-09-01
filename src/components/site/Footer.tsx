import Link from "next/link";
import { brand } from "@/lib/brand";
import { Section } from "@/components/site/Section";

export function Footer() {
  return (
    <Section id="contact" theme="dark" order={99} className="pt-24 pb-10">
      <div className="grid gap-14 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="t-mono mb-5 opacity-50">Contacto directo</p>
          <h2 className="t-h1 max-w-[15ch]">
            Habla con un <span className="serif-accent blue">estratega</span>, no con un comercial.
          </h2>
          <p className="t-body mt-6 max-w-[46ch] opacity-65">
            Te enseñamos, en vivo, el comportamiento que tu web ya está generando y que hoy
            no estás midiendo. Sin presentación comercial.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href={`https://wa.me/${brand.whatsapp}`}
              target="_blank" rel="noopener noreferrer"
              data-track-cta="footer-whatsapp"
              className="btn btn-primary"
            >
              <span>Abrir WhatsApp →</span>
            </a>
            <a href={`mailto:${brand.email}`} data-track-cta="footer-email" className="btn btn-ghost">
              <span>{brand.email}</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-[13px]">
          <div>
            <p className="t-mono mb-4 opacity-50">Navegación</p>
            <ul className="flex list-none flex-col gap-2.5 p-0">
              {[
                { href: "/", label: "Home" },
                { href: "/services", label: "Servicios" },
                { href: "/method", label: "Método" },
                { href: "/dashboard", label: "Dashboard" },
                { href: "/onboarding", label: "Onboarding" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="no-underline opacity-65 hover:opacity-100" style={{ color: "var(--color-cream)" }}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="t-mono mb-4 opacity-50">Disciplinas</p>
            <ul className="flex list-none flex-col gap-2.5 p-0 opacity-65">
              {brand.disciplines.map((d) => <li key={d}>{d}</li>)}
              <li>Meta &amp; Google Ads</li>
              <li>Marketing Automation</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="hairline-t mt-16 flex flex-wrap items-center justify-between gap-4 pt-6">
        <p className="t-mono opacity-45">© {new Date().getFullYear()} {brand.legalName}</p>
        <div className="t-mono flex gap-6 opacity-45">
          <Link href="/privacy" className="no-underline" style={{ color: "inherit" }}>Privacidad &amp; Datos</Link>
          <span>{brand.disciplines.join(" · ")}</span>
        </div>
      </div>
    </Section>
  );
}
