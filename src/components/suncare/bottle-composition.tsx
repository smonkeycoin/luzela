import Image from "next/image";
import styles from "./suncare.module.css";

/** Only the unchanged canonical product photograph, never a generated label. */
export function BottleComposition({ units = 1, eager = false }: { units?: number; eager?: boolean }) {
  const count = Math.max(1, Math.min(units, 3));
  return <div className={styles.bottles} data-bottle-count={count} role="img" aria-label={`${units} ${units === 1 ? "Luzela" : "Luzelas"}, envase original SPF 50 de 50 ml`}>
    {Array.from({ length: count }, (_, index) => <Image key={index} src="/luzela/bottle.webp" alt="" width={700} height={1050}
      sizes="(max-width: 600px) 180px, 280px" loading={eager ? "eager" : "lazy"} className={styles.bottle}
      style={{ left: `${50 + (index - (count - 1) / 2) * 23}%`, zIndex: index + 1 }} />)}
    {units > 3 ? <span className={styles.wholesaleLabel}>{units} piezas</span> : null}
  </div>;
}
