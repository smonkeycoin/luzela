import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { CartView } from "@/components/cart-view";
import { getActiveProducts } from "@/lib/catalog/get-active-products";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; quantity?: string }>;
}) {
  const { variant, quantity } = await searchParams;
  const { products } = await getActiveProducts();
  const parsedQuantity = Number(quantity || "1");
  const initialItems =
    variant && Number.isInteger(parsedQuantity) && parsedQuantity > 0
      ? [{ variantId: variant, quantity: Math.min(parsedQuantity, 10) }]
      : [];

  return (
    <main className="min-h-screen">
      <PublicHeader />
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
          Carrito
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-[var(--ink)]">
          Revisa tu pedido.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">
          Ajusta cantidades, revisa subtotales y continúa al checkout seguro.
        </p>
        <div className="mt-8">
          <CartView products={products} initialItems={initialItems} />
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
