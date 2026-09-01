export interface Faq { q: string; a: string; }

export const faqs: Faq[] = [
  {
    q: "¿Esto es legal? Suena a espiar al usuario.",
    a: "Es lo contrario. Medimos comportamiento —scroll, tiempo, dudas—, nunca el contenido que la persona escribe. Nada de tracking personalizado ocurre antes del consentimiento explícito, arrancamos con Consent Mode v2 en denegado por defecto y el visitante puede revocarlo en un clic. Además le enseñamos su propio informe: es más transparente que cualquier banner de cookies.",
  },
  {
    q: "¿En qué se diferencia de Google Analytics o Hotjar?",
    a: "GA4 te dice qué pasó en agregado. Hotjar te deja ver grabaciones que nadie revisa. Nosotros convertimos el comportamiento en un score por visitante, lo devolvemos a Meta y Google por servidor para que optimicen mejor, y lo enrutamos a una acción concreta: a quién se llama hoy y a quién no.",
  },
  {
    q: "¿Qué gano exactamente con Conversions API?",
    a: "Recuperas entre un 20 % y un 40 % de conversiones que hoy se pierden por ITP, ATT y bloqueadores. Eso no es un número de reporting: es información que el algoritmo de puja de Meta no está recibiendo, y por eso tu CPA sube con el tiempo sin explicación aparente.",
  },
  {
    q: "¿Sirve si mi ticket es bajo o vendo B2C masivo?",
    a: "El scoring conductual rinde mejor cuanto mayor es el valor de la decisión y más largo el ciclo. Con ticket alto y ciclos de semanas es donde más impacto tiene. En B2C de impulso el sistema sigue mejorando la señal para ads, pero el enrutamiento humano aporta menos.",
  },
  {
    q: "¿Qué pasa con AIO y GEO? ¿No es SEO de siempre?",
    a: "No. El SEO clásico optimiza para posiciones en una lista de enlaces. AIO y GEO optimizan para ser la fuente que un modelo cita cuando responde. Cambia la unidad de trabajo: entidades verificables, datos estructurados, autoridad demostrable y contenido que responde de forma extraíble.",
  },
  {
    q: "¿Cuánto tarda en dar resultados?",
    a: "La instrumentación da visibilidad en 2-3 semanas. Las primeras decisiones automatizadas, hacia la semana 6. El sistema completo alcanza velocidad de crucero a los 90 días. Quien prometa conversiones rentables la primera semana está vendiendo suerte, no un sistema.",
  },
  {
    q: "¿Necesito darles acceso a mis cuentas publicitarias?",
    a: "Sí, y se hace por invitación de partner desde tu propio Business Manager y tu Google Business Profile. Tú mantienes la propiedad de los activos, los píxeles y los datos. Si algún día nos vamos, todo se queda contigo.",
  },
  {
    q: "¿Hay permanencia?",
    a: "No. Retainer mensual con preaviso razonable. Un contrato largo protege a la agencia de sus propios resultados; preferimos que el sistema sea la razón para quedarse.",
  },
];

export const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};
