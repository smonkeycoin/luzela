export default function AdminShippingPage() {
  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">Shipping</h1>
      <section className="surface mt-6 rounded-[8px] p-5">
        <p className="text-sm leading-6 text-[var(--muted)]">
          Shipments soportara carrier, tracking, fechas y transiciones de
          preparing a delivered sin mezclar fulfillment con pago.
        </p>
      </section>
    </main>
  );
}
