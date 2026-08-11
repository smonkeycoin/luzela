export default function AdminProductsPage() {
  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">Products</h1>
      <section className="surface mt-6 rounded-[8px] p-5">
        <p className="text-sm leading-6 text-[var(--muted)]">
          Catalogo dinamico preparado para products, product_variants,
          product_images e inventory. No requiere deploy para cambiar precio,
          SKU, bundle, imagenes, estado u orden de aparicion.
        </p>
      </section>
    </main>
  );
}
