import { InfoPage } from "@/components/info-page";

const faqs = [
  {
    question: "¿Es para niños?",
    answer:
      "Sí. Luzela es un protector solar 100% mineral y no contiene filtros químicos. Como con cualquier producto para la piel, si existe antecedente de alergias o alguna condición dermatológica específica, se recomienda consultar previamente con su pediatra.",
  },
  {
    question: "¿Deja sensación grasosa?",
    answer:
      "No. Luzela está formulado para sentirse ligero sobre la piel, sin dejar una sensación pesada o grasosa. Está pensado para acompañarte todos los días, no solo cuando vas a la playa.",
  },
  {
    question: "¿Es amigable con cenotes?",
    answer:
      "Sí. Luzela es un protector solar 100% mineral y su fórmula es Ocean & Cenote Friendly, pensada para acompañarte también en días de mar, cenote y naturaleza.",
  },
  {
    question: "¿Dónde se fabrica?",
    answer: "Luzela está hecho en México y se fabrica en Guadalajara, Jalisco.",
  },
  {
    question: "¿Los Summer Packs incluyen envío?",
    answer:
      "Sí. SUMMER 1X, SUMMER 2X y SUMMER 3X incluyen envío a todo México. El precio que ves ya incluye el envío.",
  },
  {
    question: "¿Cuánto tarda el envío?",
    answer:
      "Realizamos nuestros envíos con DHL. Una vez confirmado tu pedido, el tiempo estimado de entrega es de 2 a 5 días hábiles, dependiendo del destino.",
  },
  {
    question: "¿Cómo rastreo mi pedido?",
    answer:
      "Cuando tu pedido esté listo para salir, recibirás automáticamente por correo electrónico tu número de guía DHL y la información para rastrear tu envío.",
  },
  {
    question: "¿Qué métodos de pago aceptan?",
    answer:
      "Aceptamos pagos seguros con Mercado Pago. Los métodos disponibles se muestran dentro del checkout según la cuenta e integración activa.",
  },
  {
    question: "¿Necesito crear una cuenta para comprar?",
    answer: "No. Puedes completar tu compra directamente sin crear una cuenta.",
  },
];

export default function FAQPage() {
  return (
    <InfoPage eyebrow="Ayuda" title="Preguntas frecuentes">
      <div className="grid gap-3">
        {faqs.map((faq, index) => (
          <details
            key={faq.question}
            className="border-b border-[var(--line)] py-5 open:border-[var(--teal)]"
            open={index === 0}
          >
            <summary className="focus-ring cursor-pointer list-none text-base font-semibold text-[var(--ink)] [&::-webkit-details-marker]:hidden">
              {faq.question}
            </summary>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{faq.answer}</p>
          </details>
        ))}
      </div>
    </InfoPage>
  );
}
