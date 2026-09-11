import Image from "next/image";
import type { ReactNode } from "react";

type ProductPackImageContext = "card" | "cart" | "checkout";

const opticalOffsets: Record<
  ProductPackImageContext,
  Record<number, { x: number; y: number }>
> = {
  card: {
    1: { x: 78, y: 40 },
    2: { x: 81, y: 46 },
    3: { x: 42, y: 62 },
  },
  cart: {
    1: { x: 47, y: 26 },
    2: { x: 52, y: 30 },
    3: { x: 58, y: 32 },
  },
  checkout: {
    1: { x: 36, y: 22 },
    2: { x: 40, y: 24 },
    3: { x: 45, y: 26 },
  },
};

const contextClasses: Record<ProductPackImageContext, string> = {
  card: "h-[230px] sm:h-[250px]",
  cart: "h-[170px] w-full sm:h-[180px] sm:w-[200px]",
  checkout: "h-[128px] w-[128px] sm:h-[154px] sm:w-[160px]",
};

function getBottleHeight(unitsPerPack: number, context: ProductPackImageContext) {
  if (context === "card") {
    if (unitsPerPack === 1) return "h-[218px] sm:h-[236px]";
    if (unitsPerPack === 2) return "h-[226px] sm:h-[244px]";
    return "h-[226px] sm:h-[246px]";
  }

  if (context === "cart") {
    if (unitsPerPack === 1) return "h-[140px] sm:h-[156px]";
    if (unitsPerPack === 2) return "h-[148px] sm:h-[166px]";
    return "h-[154px] sm:h-[172px]";
  }

  if (unitsPerPack === 1) return "h-[110px] sm:h-[132px]";
  if (unitsPerPack === 2) return "h-[116px] sm:h-[140px]";
  return "h-[122px] sm:h-[146px]";
}

function getStageTone(unitsPerPack: number, context: ProductPackImageContext) {
  if (context === "card" && unitsPerPack === 3) {
    return "border-[var(--teal)]/30";
  }

  return "border-[var(--line)]";
}

function getOffset(unitsPerPack: number, index: number, context: ProductPackImageContext) {
  const center = (unitsPerPack - 1) / 2;
  const spacing = context === "card" ? 44 : context === "cart" ? 38 : 30;

  return (index - center) * (unitsPerPack === 1 ? 0 : spacing);
}

function getStackWidth(unitsPerPack: number, context: ProductPackImageContext) {
  const base = context === "card" ? 116 : context === "cart" ? 78 : 66;
  const step = context === "card" ? 40 : context === "cart" ? 34 : 26;

  return Math.min(base + unitsPerPack * step, context === "card" ? 240 : context === "cart" ? 210 : 160);
}

function getOpticalOffset(unitsPerPack: number, context: ProductPackImageContext) {
  return opticalOffsets[context][unitsPerPack] || { x: 0, y: 0 };
}

export function ProductPackImage({
  alt,
  context,
  feature,
  unitsPerPack,
}: {
  alt: string;
  context: ProductPackImageContext;
  feature?: ReactNode;
  unitsPerPack: number;
}) {
  const displayCount = Math.max(1, Math.min(unitsPerPack, 3));
  const opticalOffset = getOpticalOffset(displayCount, context);
  const isWholesale = unitsPerPack > displayCount;

  return (
    <div
      className={`relative grid place-items-center overflow-hidden border bg-white ${contextClasses[context]} ${getStageTone(displayCount, context)}`}
      data-pack-image={`${context}-${unitsPerPack}x`}
    >
      {feature}
      <div
        className={`relative ${getBottleHeight(displayCount, context)}`}
        style={{ width: `${getStackWidth(displayCount, context)}px` }}
      >
        {Array.from({ length: displayCount }).map((_, index) => (
          <Image
            key={index}
            src="/luzela/bottle.webp"
            alt={index === displayCount - 1 ? alt : ""}
            width={700}
            height={1050}
            sizes={
              context === "card"
                ? "(max-width: 767px) 70vw, 240px"
                : context === "cart"
                  ? "170px"
                  : "150px"
            }
            className="absolute left-1/2 top-[80%] h-full w-auto -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-xl"
            data-pack-bottle={`${context}-${unitsPerPack}x`}
            style={{
              transform: `translate3d(calc(-50% + ${getOffset(displayCount, index, context) + opticalOffset.x}px), calc(-50% + ${opticalOffset.y}px), 0)`,
              zIndex: index + 1,
            }}
          />
        ))}
      </div>
      {isWholesale ? (
        <span className="absolute right-3 top-3 border border-[var(--teal)]/30 bg-[var(--background)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--teal)] sm:text-xs">
          {unitsPerPack} piezas
        </span>
      ) : null}
      <span className="sr-only">
        {unitsPerPack} pieza{unitsPerPack === 1 ? "" : "s"} Luzela
      </span>
    </div>
  );
}
