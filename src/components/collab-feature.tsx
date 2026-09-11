import Image from "next/image";
import Link from "next/link";
export function CollabProof() {
  return (
    <section
      aria-label="Visto en"
      className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-y border-[var(--line)] bg-white px-5 py-6"
    >
      <span className="text-[10px] font-semibold tracking-[.25em] text-[var(--muted)]">
        VISTO EN
      </span>
      <Link href="/#tienda">
        <Image
          src="/collabs/elmundoenpareja/EL MUNDO EN PAREJA Negro.png"
          alt="El Mundo en Pareja"
          width={216}
          height={47}
            className="h-auto"
        />
      </Link>
    </section>
  );
}
export function CollabFeature({ full = false }: { full?: boolean }) {
  return (
    <section className="bg-[#edece1]" aria-label="LUZELA × CHAVOLINES">
      <div className="mx-auto grid max-w-7xl md:grid-cols-2">
        <div className="relative aspect-[4/5] min-h-0 md:aspect-auto">
          <Image
            src="/collabs/elmundoenpareja/elmundoenparejaHERO.jpg"
            alt="Chava y Nat en la playa con su familia"
            fill
            priority={full}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-center"
          />
          <span className="absolute bottom-5 left-5 text-xs font-medium tracking-[.2em] text-white">
            DE CANCÚN AL MUNDO.
          </span>
        </div>
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 lg:py-20">
          <p className="text-xs font-semibold tracking-[.2em] text-[var(--teal)]">
            LUZELA × CHAVOLINES
          </p>
          {full ? (
            <h1 className="mt-6 text-5xl font-semibold leading-[.95] tracking-tight lg:text-7xl">
              VERANO
              <br />
              FOREVER.
            </h1>
          ) : (
            <h2 className="mt-6 text-5xl font-semibold leading-[.95] tracking-tight lg:text-6xl">
              VERANO
              <br />
              FOREVER.
            </h2>
          )}
          <p className="mt-6 max-w-sm text-lg leading-8 text-[var(--muted)]">
            El sol también viaja contigo.
            <br />
            LUZELA se va de viaje con El Mundo en Pareja.
          </p>
          <Image
            src="/collabs/elmundoenpareja/EL MUNDO EN PAREJA Negro.png"
            alt="El Mundo en Pareja — logo oficial"
            width={230}
            height={50}
            className="mt-7 h-auto"
          />
          <Link
            href="/#tienda"
            className="focus-ring mt-6 inline-flex min-h-12 items-center justify-center bg-[var(--ink)] px-5 py-3 text-center text-sm font-semibold text-white"
          >
            {"ELEGIR MI SUMMER"}{" "}
            <span className="ml-4" aria-hidden>
              ↗
            </span>
          </Link>

        </div>
      </div>
    </section>
  );
}
