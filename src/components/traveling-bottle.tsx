"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type BottleStyle = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
};

const initialStyle: BottleStyle = {
  x: 0,
  y: 0,
  scale: 1,
  opacity: 0,
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function mix(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function smooth(progress: number) {
  const next = clamp(progress);
  return next * next * (3 - 2 * next);
}

function centerOf(element: Element | null) {
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    width: rect.width,
    height: rect.height,
  };
}

export function TravelingBottle() {
  const frameRef = useRef<number | null>(null);
  const reducedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [style, setStyle] = useState<BottleStyle>(initialStyle);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = motionQuery.matches;

    if (motionQuery.matches) {
      window.setTimeout(() => setReducedMotion(true), 0);
      document.documentElement.classList.remove("traveling-luzela-ready");
      return undefined;
    }

    const update = () => {
      frameRef.current = null;

      const hero = centerOf(document.querySelector("[data-travel-hero-bottle]"));
      const benefits = document.querySelector("[data-travel-benefits]");
      const products = document.querySelector("[data-travel-products]");
      const stickySlot = centerOf(document.querySelector("[data-travel-sticky-slot]"));
      const reviews = document.querySelector("[data-travel-exit]");

      if (!hero) {
        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollY = window.scrollY;
      const mobile = viewportWidth < 768;
      const tablet = viewportWidth >= 768 && viewportWidth < 1180;
      const baseWidth = mobile ? 120 : tablet ? 190 : 320;
      const heroScale = clamp(hero.width / baseWidth, mobile ? 1.45 : 1, mobile ? 2.2 : 1.85);
      const benefitsRect = benefits?.getBoundingClientRect() ?? {
        top: viewportHeight * 0.82,
      };
      const productsRect = products?.getBoundingClientRect() ?? {
        top: viewportHeight * 1.35,
      };
      const reviewsRect = reviews?.getBoundingClientRect() ?? {
        top: viewportHeight * 2.4,
      };
      const benefitsTop = benefitsRect.top + scrollY;
      const productsTop = productsRect.top + scrollY;
      const reviewsTop = reviewsRect.top + scrollY;
      const handoffProgress = smooth(scrollY / Math.max(1, benefitsTop * 0.9));
      const productProgress = smooth(
        (scrollY - (productsTop - viewportHeight * 0.95)) / Math.max(1, viewportHeight * 0.45),
      );
      const exitProgress = smooth(
        (scrollY - (reviewsTop - viewportHeight * 0.35)) / Math.max(1, viewportHeight * 0.3),
      );
      const productExitProgress = smooth(
        (scrollY - (productsTop - viewportHeight * 0.95)) / Math.max(1, viewportHeight * 0.5),
      );
      const mobileProductExit = mobile
        ? smooth(
            (scrollY - (productsTop - viewportHeight * 0.9)) /
              Math.max(1, viewportHeight * 0.42),
          )
        : 0;

      const benefitsTarget = {
        x: mobile ? viewportWidth - 76 : tablet ? viewportWidth - 140 : viewportWidth - 220,
        y: mobile ? 132 : tablet ? 190 : 230,
        scale: mobile ? 0.78 : tablet ? 0.72 : 0.58,
      };
      const productTarget = {
        x: mobile
          ? viewportWidth - 58
          : tablet
            ? stickySlot?.x ?? viewportWidth - 106
            : stickySlot?.x ?? viewportWidth - 142,
        y: mobile
          ? 118
          : stickySlot?.y
            ? Math.min(Math.max(stickySlot.y, 220), viewportHeight - 220)
            : 330,
        scale: mobile ? 0.56 : tablet ? 0.58 : 0.48,
      };

      const fromHeroToBenefits = {
        x: mix(hero.x, benefitsTarget.x, handoffProgress),
        y: mix(hero.y, benefitsTarget.y, handoffProgress),
        scale: mix(heroScale, benefitsTarget.scale, handoffProgress),
      };
      const fromBenefitsToProducts = {
        x: mix(fromHeroToBenefits.x, productTarget.x, productProgress),
        y: mix(fromHeroToBenefits.y, productTarget.y, productProgress),
        scale: mix(fromHeroToBenefits.scale, productTarget.scale, productProgress),
      };
      const primary = {
        x: fromBenefitsToProducts.x,
        y: fromBenefitsToProducts.y,
        scale: fromBenefitsToProducts.scale,
      };

      setStyle({
        x: primary.x,
        y: primary.y,
        scale: primary.scale,
        opacity: 1 - Math.max(exitProgress, mobileProductExit, productExitProgress),
      });
      setReady(true);
      document.documentElement.classList.add("traveling-luzela-ready");
    };

    const schedule = () => {
      reducedRef.current = motionQuery.matches;
      setReducedMotion(motionQuery.matches);
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motionQuery.addEventListener("change", schedule);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motionQuery.removeEventListener("change", schedule);
      document.documentElement.classList.remove("traveling-luzela-ready");
    };
  }, []);

  if (reducedMotion) {
    return (
      <div
        data-testid="traveling-bottle-layer"
        aria-hidden="true"
        className="pointer-events-none hidden"
      />
    );
  }

  return (
    <div
      data-testid="traveling-bottle-layer"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10 overflow-hidden motion-reduce:hidden"
      style={{
        contain: "layout paint",
        height: "100dvh",
        maxWidth: "100vw",
        opacity: ready ? 1 : 0,
        width: "100vw",
      }}
    >
      <Image
        data-testid="traveling-bottle-primary"
        src="/luzela/bottle.webp"
        alt=""
        width={320}
        height={420}
        draggable={false}
        className="absolute left-0 top-0 h-auto w-[120px] max-w-none select-none drop-shadow-2xl md:w-[190px] xl:w-[320px]"
        style={{
          opacity: style.opacity,
          height: "auto",
          transform: `translate3d(${style.x}px, ${style.y}px, 0) translate3d(-50%, -50%, 0) scale(${style.scale})`,
          transformOrigin: "50% 50%",
          willChange: "transform, opacity",
        }}
      />
    </div>
  );
}
