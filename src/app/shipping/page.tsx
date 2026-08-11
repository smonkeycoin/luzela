import { InfoPage } from "@/components/info-page";

export default function ShippingPage() {
  return (
    <InfoPage eyebrow="Ayuda" title="Envíos">
      <section className="surface rounded-[8px] p-5">
        <h2 className="text-base font-semibold text-[var(--ink)]">DHL a todo México</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Realizamos nuestros envíos con DHL. Una vez confirmado tu pedido, el
          tiempo estimado de entrega es de 2 a 5 días hábiles, dependiendo del
          destino.
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Cuando tu pedido esté listo para salir, recibirás automáticamente por
          correo electrónico tu número de guía DHL y la información para rastrear
          tu envío.
        </p>
      </section>
    </InfoPage>
  );
}
