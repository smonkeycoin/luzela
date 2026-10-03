import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { SummerDropCampaign } from "@/components/summer-drop-campaign";
import { getActiveProducts } from "@/lib/catalog/get-active-products";
import { isSummerDropProduct } from "@/lib/catalog/summer-drop";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Summer Drop | Luzela México",
  description: "Una edición limitada para compartir más días de sol. Descubre Summer Drop de Luzela, protección solar mineral SPF 50+ hecha en México.",
  alternates: { canonical: "https://www.luzela.mx/summer-drop" },
  openGraph: { title: "Summer Drop | Luzela México", url: "https://www.luzela.mx/summer-drop" },
};

export default async function SummerDropPage() {
  const { products, error } = await getActiveProducts();
  const product = products.find(isSummerDropProduct);
  return (
    <main className="min-h-screen">
      <PublicHeader />
      {product ? <SummerDropCampaign product={product} dedicated /> : (
        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <p className="text-xs uppercase tracking-[.2em] text-[var(--teal)]">LUZELA México</p>
          <h1 className="mt-5 text-5xl font-medium">Summer Drop</h1>
          <p className="mt-6 leading-7 text-[var(--muted)]">{error ? "No pudimos consultar esta edición en este momento. Vuelve a intentarlo en unos minutos." : "Esta edición ha terminado. Descubre las opciones disponibles para tus próximos días de sol."}</p>
        </section>
      )}
      <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8 lg:pb-16" aria-label="Tu ritual de sol">
        <div className="grid gap-6 border-y border-[var(--line)] py-7 sm:grid-cols-3">
          <p className="text-sm leading-6"><strong className="block font-semibold">La misma Luzela.</strong><span className="text-[var(--muted)]">Protección solar mineral SPF 50+, en su presentación original de 50 ml.</span></p>
          <p className="text-sm leading-6"><strong className="block font-semibold">Hecha en México.</strong><span className="text-[var(--muted)]">De la ciudad al mar, para acompañar tus días bajo el sol.</span></p>
          <p className="text-sm leading-6"><strong className="block font-semibold">A todo México.</strong><span className="text-[var(--muted)]">Envío incluido. Consulta los detalles de entrega al finalizar tu pedido.</span></p>
        </div>
        <Link href="/#tienda" className="focus-ring mt-6 inline-block border-b border-[var(--ink)] pb-1 text-sm">Ver todas las opciones de Luzela ↗</Link>
      </section>
      <PublicFooter />
    </main>
  );
}
