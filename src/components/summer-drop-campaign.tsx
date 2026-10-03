import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CatalogProduct } from "@/lib/catalog/types";
import { AddToCartButton } from "./add-to-cart-button";

export function SummerDropCampaign({ product, dedicated = false }: {
  product: CatalogProduct;
  dedicated?: boolean;
}) {
  const Heading = dedicated ? "h1" : "h2";
  return (
    <section id="summer-drop" aria-label="Summer Drop" className="scroll-mt-20 px-5 py-10 sm:px-8 lg:py-16">
      <div className="summer-drop-editorial mx-auto grid max-w-7xl overflow-hidden bg-[#e4f0ec] text-[#123e40] md:grid-cols-2">
        <div className="px-6 pt-7 sm:px-10 sm:pt-10 lg:px-16 lg:pt-14">
          <p className="text-[10px] font-semibold uppercase tracking-[.24em] sm:text-xs">Summer Drop · Edición limitada</p>
          <Heading className="mt-4 text-[2.65rem] font-medium uppercase leading-[.98] tracking-[-.045em] sm:text-6xl lg:text-7xl">
            Paga 2.<br />Recibe 3.
          </Heading>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#34585a] sm:text-base sm:leading-7">Más días de sol. Más momentos para compartir.</p>
        </div>
        <figure className="relative mx-6 mt-5 h-[220px] overflow-hidden sm:mx-10 md:col-start-2 md:row-start-1 md:row-span-2 md:m-0 md:h-full md:min-h-[490px]">
          <Image src="/luzela/hero-wide.webp" alt="" fill sizes="(max-width: 767px) 100vw, 50vw" className="object-cover object-left opacity-15" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#d4e9e380_0%,#d4e9e310_55%,#c3dcd380_100%)]" />
          <div className="absolute inset-x-0 bottom-6 top-2 md:bottom-14 md:top-12" role="img" aria-label="Tres botellas originales Luzela SPF 50, de 50 ml cada una">
            {[0, 1, 2].map((index) => (
              <Image key={index} src="/luzela/bottle.webp" alt="" width={700} height={1050}
                priority={dedicated} sizes="(max-width: 767px) 145px, 300px"
                className={`absolute bottom-0 w-auto -translate-x-1/2 object-contain drop-shadow-xl ${index === 1 ? "z-10 h-full" : "h-[88%]"}`}
                style={{ left: `${30 + index * 20}%` }}
              />
            ))}
          </div>
          <figcaption className="absolute inset-x-0 bottom-2 text-center text-[9px] font-medium uppercase tracking-[.2em] md:bottom-6 md:text-[10px]">Protección mineral · SPF 50+ · 3 × 50 ml</figcaption>
        </figure>
        <div className="px-6 pb-7 pt-5 sm:px-10 sm:pb-10 lg:px-16 lg:pb-14">
          <div className="flex items-end justify-between gap-3 border-t border-[#123e40]/15 pt-4 md:block">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.15em]">3 Luzelas</p>
              <p className="mt-1 flex items-baseline gap-2"><span className="text-3xl font-medium tracking-tight sm:text-4xl">$769</span><span className="text-[10px]">MXN</span><span className="text-sm text-[#34585a] line-through" aria-label="Precio regular 819 pesos">$819</span></p>
            </div>
            <p className="pb-1 text-xs md:mt-2">Envío incluido.</p>
          </div>
          <div className="mt-5">
            {dedicated ? <AddToCartButton product={product} featured /> : (
              <Link href="/summer-drop" className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-3 bg-[#123e40] px-4 py-3 text-center text-[11px] font-semibold tracking-[.08em] text-white transition hover:bg-[#1d5557] sm:w-auto sm:px-6">
                DESCUBRIR SUMMER DROP <ArrowRight size={16} aria-hidden />
              </Link>
            )}
          </div>
          <p className="mt-3 text-[10px] leading-5 text-[#34585a]">Hasta agotar existencias. No acumulable con otros descuentos.</p>
        </div>
      </div>
    </section>
  );
}
