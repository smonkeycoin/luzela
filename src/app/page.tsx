import { CollabFeature, CollabProof } from "@/components/collab-feature";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";

import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { ShopSection } from "@/components/shop-section";
import { TravelingBottle } from "@/components/traveling-bottle";
import { SummerDropCampaign } from "@/components/summer-drop-campaign";
import { isSummerDropProduct } from "@/lib/catalog/summer-drop";
import { getActiveProducts } from "@/lib/catalog/get-active-products";
import { getFeatureFlags } from "@/lib/settings";

export const dynamic = "force-dynamic";

const benefits = [
  "SPF 50+",
  "100% mineral",
  "Libre de grasa",
  "Vegano",
  "Ocean & Cenote Friendly",
  "Hecho en México",
];

const reviews = [
  { name: "Marcel", quote: "Excelente producto 🙌" },
  { name: "Azu", quote: "No me sacó granitos y lo sentí súper fresco." },
  {
    name: "Ana K.",
    quote: "Me encanta porque no te deja grasosa la piel, y mi esposo se deja poner.",
  },
  {
    name: "Ale G.",
    quote: "El mejor bloqueador, cero grasoso y me deja la piel radiante. Lo uso diario lit.",
  },
];

export default async function Home() {
  const [{ products, error }, featureFlags] = await Promise.all([
    getActiveProducts(),
    getFeatureFlags(),
  ]);
  const summerDropProduct = products.find(isSummerDropProduct);

  return (
    <main className="min-h-screen">
      <PublicHeader />
      <TravelingBottle />

      <section className="relative isolate overflow-hidden border-b border-[var(--line)]">
        <Image
          src="/luzela/hero-wide.webp"
          alt="Luzela en un día de sol junto al agua"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-28"
        />
        <div className="absolute inset-0 -z-10 bg-[var(--background)]/68" />
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
              SUMMER LUZELA
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] text-[var(--ink)] sm:text-7xl">
              Más Luzela. Más días bajo el sol.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-[var(--muted)] sm:text-lg">
              Protección solar mineral SPF 50+. Elige la cantidad que acompaña tu verano.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/#tienda"
                className="focus-ring inline-flex h-12 items-center justify-center gap-2 bg-[var(--ink)] px-5 text-sm font-semibold text-white transition hover:bg-black"
              >
                Ver Summer Packs
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Link
                href="https://about.luzela.mx"
                className="focus-ring inline-flex h-12 items-center justify-center border border-[var(--ink)] px-5 text-sm font-semibold text-[var(--ink)] transition hover:bg-white"
              >
                Nuestra historia
              </Link>
            </div>
          </div>
          <div
            data-travel-hero-bottle
            className="hero-static-bottle mx-auto grid w-full max-w-sm place-items-center lg:max-w-md"
          >
            <Image
              src="/luzela/bottle.webp"
              alt="Luzela SPF 50+"
              width={520}
              height={640}
              priority
              sizes="(max-width: 768px) 70vw, 420px"
              className="h-auto w-[78%] max-w-sm object-contain drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section data-travel-benefits className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-4 px-5 py-5 sm:px-8">
          {benefits.map((benefit) => (
            <p
              key={benefit}
              className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink)]"
            >
              {benefit}
            </p>
          ))}
        </div>
      </section>

      <CollabProof />
      {summerDropProduct ? <SummerDropCampaign product={summerDropProduct} /> : null}
      <ShopSection products={products} error={error} />

      {featureFlags.publicReviewsEnabled ? (
      <section data-travel-exit className="border-y border-[var(--line)] bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
              Reseñas
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-[var(--ink)]">
              Ligera en la piel, memorable en cada rutina.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {reviews.map((review) => (
              <figure key={review.name} className="border-t border-[var(--line)] pt-5">
                <div className="flex gap-1 text-[var(--sun)]" aria-label="5 estrellas">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} size={15} fill="currentColor" aria-hidden />
                  ))}
                </div>
                <blockquote className="mt-4 text-sm leading-7 text-[var(--muted)]">
                  &ldquo;{review.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-3 text-sm font-semibold text-[var(--ink)]">
                  {review.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
      ) : (
        <div data-travel-exit className="h-px" aria-hidden="true" />
      )}

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1fr] lg:items-center lg:py-24">
        <div className="relative min-h-[420px] overflow-hidden">
          <Image
            src="/luzela/texture.webp"
            alt="Textura editorial Luzela"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div className="max-w-xl lg:pl-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            DEL CARIBE A TU RUTINA DIARIA
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-[var(--ink)] sm:text-4xl">
            Conoce la historia detrás de Luzela y los días que inspiran la marca.
          </h2>
          <Link
            href="https://about.luzela.mx"
            className="focus-ring mt-7 inline-flex h-12 items-center justify-center gap-2 border border-[var(--ink)] px-5 text-sm font-semibold text-[var(--ink)]"
          >
            Descubrir Luzela
            <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
      </section>

      <CollabFeature />
      <PublicFooter />
    </main>
  );
}
