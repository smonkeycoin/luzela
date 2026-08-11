export default function AdminInventoryPage() {
  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">Inventory</h1>
      <section className="surface mt-6 rounded-[8px] p-5">
        <p className="text-sm leading-6 text-[var(--muted)]">
          Inventario por ledger: purchase, sale, adjustment, return, damage y
          manual_correction. El stock visible se calcula desde movimientos.
        </p>
      </section>
    </main>
  );
}
