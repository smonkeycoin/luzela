import { InfoPage } from "@/components/info-page";
import { getShippingPolicy } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const shippingPolicy = await getShippingPolicy();

  return (
    <InfoPage eyebrow="Ayuda" title="Envíos">
      <section className="surface rounded-[8px] p-5">
        <h2 className="text-base font-semibold text-[var(--ink)]">
          {shippingPolicy.carrierDisplayName} a todo México
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Realizamos nuestros envíos con {shippingPolicy.carrierDisplayName}. Una vez
          confirmado tu pedido, el tiempo estimado de entrega es de{" "}
          {shippingPolicy.minDays} a {shippingPolicy.maxDays}{" "}
          {shippingPolicy.businessDays ? "días hábiles" : "días"}, dependiendo del
          destino.
        </p>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Cuando tu pedido esté listo para salir, recibirás automáticamente por
          correo electrónico tu número de guía {shippingPolicy.carrierDisplayName} y la
          información para rastrear tu envío.
        </p>
      </section>
    </InfoPage>
  );
}
