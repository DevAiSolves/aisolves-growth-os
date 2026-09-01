import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Section } from "@/components/site/Section";
import { PrivacyControls } from "@/components/capture/PrivacyControls";

export const metadata: Metadata = {
  title: "Privacidad y datos",
  description: "Qué medimos exactamente, qué nunca tocamos y cómo revocar el consentimiento.",
};

const collected = [
  ["Comportamiento de scroll", "Profundidad, velocidad y retrocesos de lectura."],
  ["Atención por sección y bloque", "Tiempo real visible y activo, sin contar pestañas en segundo plano ni inactividad."],
  ["Interacción", "Hover sostenido, clics, aperturas de acordeón, reproducción de vídeo."],
  ["Metadata de formularios", "Cuánto tardas en rellenar, si corrigés, si pegas texto, si el campo es válido. Nunca el valor escrito."],
  ["Fricción", "Rage clicks, clics muertos e intención de salida."],
  ["Origen", "Parámetros UTM, referrer e identificadores de clic de campaña (fbclid, gclid)."],
  ["Entorno", "Tipo de dispositivo, sistema, navegador, idioma, zona horaria y país aproximado."],
];

const never = [
  "El contenido que escribes en cualquier campo",
  "Grabaciones de pantalla o de pulsaciones de teclado",
  "Fingerprinting de canvas, audio o WebGL",
  "Datos de otras webs que visitas",
  "Venta o cesión de tus datos a terceros",
];

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main>
        <Section id="hero" order={1} theme="dark" className="pt-[140px] pb-16">
          <p className="t-mono blue mb-5">Privacidad y datos</p>
          <h1 className="t-h1 max-w-[18ch]">Lo medimos todo. Y te contamos exactamente qué.</h1>
          <p className="t-body mt-7 max-w-[62ch] opacity-65">
            Vendemos sistemas de comportamiento. Sería incoherente ser opacos con el nuestro.
            Esto es la lista completa, sin letra pequeña.
          </p>
        </Section>

        <Section id="engine" order={2} theme="dark" className="pb-24">
          <div className="grid gap-14 lg:grid-cols-2">
            <div>
              <h2 className="t-h2 mb-7" style={{ fontSize: "1.6rem" }}>Qué recogemos</h2>
              <div className="hairline-t">
                {collected.map(([k, v]) => (
                  <div key={k} className="hairline-b py-4">
                    <h3 className="t-h3 mb-1" style={{ fontSize: "0.95rem" }}>{k}</h3>
                    <p className="text-[13px] leading-relaxed opacity-60">{v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="t-h2 mb-7" style={{ fontSize: "1.6rem" }}>Qué nunca tocamos</h2>
              <ul className="flex list-none flex-col gap-3 p-0">
                {never.map((n) => (
                  <li key={n} className="flex items-start gap-2.5 t-body opacity-75">
                    <span className="blue mt-[3px] shrink-0">✦</span>{n}
                  </li>
                ))}
              </ul>

              <h2 className="t-h2 mb-5 mt-12" style={{ fontSize: "1.6rem" }}>Base legal</h2>
              <p className="t-body opacity-65">
                Consentimiento explícito (art. 6.1.a RGPD) para el seguimiento personalizado y la
                publicidad. Google Consent Mode v2 arranca en denegado por defecto: hasta que
                aceptas, la medición es agregada y no personal. Puedes revocar el consentimiento
                aquí abajo en cualquier momento, y ejercer tus derechos de acceso, rectificación
                y supresión escribiendo a nuestro contacto.
              </p>
            </div>
          </div>

          <PrivacyControls />
        </Section>
      </main>
      <Footer />
    </>
  );
}
