import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Leaf, MapPin, ShieldCheck, Sun, Truck, MessageCircle, PackageCheck, Plus } from "lucide-react";
import { CollabFeature, CollabProof } from "@/components/collab-feature";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { BottleComposition } from "@/components/suncare/bottle-composition";
import { CampaignFeature } from "@/components/suncare/campaign";
import { ProductSelector } from "@/components/suncare/product-selector";
import { isVisualSuncarePreview } from "@/components/suncare/preview-mode";
import previewCatalog from "@/components/suncare/preview-catalog.json";
import { isSummerDropProduct } from "@/lib/catalog/summer-drop";
import { getActiveProducts } from "@/lib/catalog/get-active-products";
import { getFeatureFlags, getShippingPolicy } from "@/lib/settings";
import styles from "@/components/suncare/suncare.module.css";

export const dynamic = "force-dynamic";

const reviews = [
  { name: "Marcel", quote: "Excelente producto 🙌" },
  { name: "Azu", quote: "No me sacó granitos y lo sentí súper fresco." },
  { name: "Ana K.", quote: "Me encanta porque no te deja grasosa la piel, y mi esposo se deja poner." },
  { name: "Ale G.", quote: "El mejor bloqueador, cero grasoso y me deja la piel radiante. Lo uso diario lit." },
];
const benefits = [
  { title: "Protección mineral", image: "mineral-texture", text: "LUZELA es un filtro solar mineral SPF 50. Una forma de acompañar tu piel en los días al aire libre.", note: "01 / El cuidado" },
  { title: "Tu momento de cuidado", image: "skin-application", text: "Haz espacio para tu protección solar. Conoce las indicaciones del envase antes de incorporarla a tu rutina.", note: "02 / La experiencia" },
  { title: "Todos los días cuentan", image: "sunlight-shadows", text: "De la ciudad al mar: lleva tu Luzela contigo y consulta las indicaciones de aplicación y reaplicación de su etiqueta.", note: "03 / Tu rutina" },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ campaign_preview?: string }> }) {
  const [catalog, flags, shipping, params] = await Promise.all([getActiveProducts(), getFeatureFlags(), getShippingPolicy(), searchParams]);
  const previewOnly = isVisualSuncarePreview(process.env.VERCEL_ENV, process.env.NEXT_PUBLIC_SUPABASE_URL);
  const { products, error } = previewOnly ? { products: previewCatalog.products, error: undefined } : catalog;
  const summerDrop = products.find(isSummerDropProduct);
  // A visual concept is separate from authorized server promotions and unavailable in production.
  const campaignConcept = process.env.VERCEL_ENV !== "production" && params.campaign_preview === "buen-fin";
  const faqs = [
    { question: "¿Qué es un filtro solar mineral?", answer: "Es una protección solar formulada con filtros minerales. LUZELA se identifica en su envase como filtro solar mineral SPF 50. Consulta el etiquetado para conocer la fórmula y sus indicaciones." },
    { question: "¿Cómo se aplica?", answer: "Sigue las instrucciones del envase de tu LUZELA. La imagen de aplicación de esta página es una representación editorial, no una demostración del acabado real del producto." },
    { question: "¿Cada cuánto se reaplica?", answer: "Consulta el intervalo y las condiciones de reaplicación indicados en la etiqueta de tu producto. Si necesitas confirmar una indicación, contáctanos antes de usarlo." },
    { question: "¿Qué presentación me conviene?", answer: "1X contiene una pieza, 2X contiene dos y 3X contiene tres. El selector muestra el precio total, el precio por pieza y la disponibilidad actual para que elijas según tu rutina." },
    { question: "¿Cuánto cuesta el envío?", answer: "Cuando tu presentación incluye envío, lo verás indicado junto al botón de compra. Revisa el costo y el total de tu pedido en el checkout antes de continuar.", href: "/shipping", label: "Consultar envíos" },
    { question: "¿Qué métodos de pago aceptan?", answer: "El pago se procesa con Mercado Pago. Los métodos disponibles para tu compra se muestran en el checkout según la integración activa." },
    { question: "¿Necesito cuenta de Mercado Pago?", answer: "No necesitas una cuenta de Mercado Pago para pagar con tarjeta. Puedes completar el pago desde el formulario integrado en la tienda." },
    { question: "¿Cómo puedo dar seguimiento a mi pedido?", answer: `Cuando tu pedido esté listo para salir, recibirás por correo tu número de guía ${shipping.carrierDisplayName} y la información para rastrear el envío.` },
    { question: "¿Dónde están las políticas de cambios y devoluciones?", answer: "Puedes consultar su estado en nuestra página de cambios y devoluciones. La política final está pendiente de publicación; no se anuncian aquí plazos ni condiciones adicionales.", href: "/returns", label: "Cambios y devoluciones" },
  ];
  return <main className={styles.home}>
    <a href="#tienda" className={styles.skipLink}>Saltar a la tienda</a>
    <PublicHeader />
    {previewOnly ? <aside className={styles.previewNotice} aria-label="Preview de diseño">Preview visual · Compras deshabilitadas. Catálogo de referencia del 13 de noviembre de 2026; sin conexión comercial.</aside> : null}
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><Sun size={15} aria-hidden /> The Suncare Edition</p>
        <h1 id="hero-title">El sol es parte<br />de <em>tu vida.</em></h1>
        <p className={styles.heroDescription}>Protección solar mineral SPF 50<br className={styles.desktopBreak} /> para acompañarte todos los días.</p>
        <Link href="/#tienda" className={styles.button}>Descubre Luzela <ArrowRight size={17} aria-hidden /></Link>
        <div className={styles.heroFootnote}><span>Hecho en México</span><span>De la ciudad al mar.</span></div>
      </div>
      <div className={styles.heroVisual}>
        <Image src="/luzela/v4/sunlight-shadows.webp" alt="" fill sizes="(max-width: 767px) 100vw, 55vw" className={styles.heroBackdrop} loading="eager" fetchPriority="high" />
        <div className={styles.heroEditorial}>
          <Image src="/luzela/v4/skin-application.webp" alt="Representación editorial de un gesto de cuidado sobre la piel" fill sizes="(max-width: 767px) 100vw, 65vw" className={styles.coverImage} loading="eager" fetchPriority="high" />
          <span>Un momento para ti.</span>
        </div>
        <div className={styles.heroBottle}><BottleComposition eager /></div>
        <span className={styles.heroEdition}>LUZELA / DAILY SUNCARE</span>
      </div>
    </section>
    <div className={styles.trustStrip} aria-label="Características del producto">
      <span><Sun aria-hidden />SPF 50</span><span><Leaf aria-hidden />Protección mineral</span><span><MapPin aria-hidden />Hecho en México</span>
    </div>
    <CollabProof />
    <section id="beneficios" className={styles.benefits} aria-labelledby="benefits-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Conoce el producto</p><h2 id="benefits-title">Tu piel también merece<br /><em>disfrutar del sol.</em></h2></div><Link href="#experiencia" className={styles.textLink}>Conoce tu Luzela <ArrowUpRight size={17} aria-hidden /></Link></div>
      <div className={styles.benefitGrid}>{benefits.map(benefit => <article key={benefit.title}>
        <div className={styles.benefitImage}><Image src={`/luzela/v4/${benefit.image}.webp`} alt="" fill sizes="(max-width: 600px) 100vw, 33vw" className={styles.coverImage} /></div>
        <p className={styles.eyebrow}>{benefit.note}</p><h3>{benefit.title}</h3><p>{benefit.text}</p>
      </article>)}</div>
      <p className={styles.editorialNote}>Imágenes editoriales generadas. No representan pruebas de textura, acabado ni resultados del producto.</p>
    </section>
    <section id="experiencia" className={styles.experience} aria-labelledby="experience-title">
      <figure className={styles.experienceImage}><Image src="/luzela/texture.webp" alt="Imagen editorial de textura del archivo de Luzela" fill sizes="(max-width: 767px) 100vw, 45vw" className={styles.coverImage} /></figure>
      <div className={styles.experienceCopy}><p className={styles.eyebrow}>El ritual de todos los días</p><h2 id="experience-title">Así se siente<br /><em>Luzela.</em></h2>
        <p>Un pequeño momento de cuidado antes de salir. En casa, en la ciudad o cerca del mar: encuentra tu propia rutina.</p>
        <ul><li><span>01</span><div><strong>Conoce tu producto</strong><p>Lee las instrucciones y precauciones de la etiqueta.</p></div></li><li><span>02</span><div><strong>Hazlo parte de tu día</strong><p>Aplica y reaplica de acuerdo con las indicaciones del envase.</p></div></li></ul>
        <Link href="#tienda" className={styles.textLink}>Encuentra tu presentación <ArrowRight size={17} aria-hidden /></Link>
        <p className={styles.editorialNote}>La imagen es editorial. Próximamente, una demostración real de aplicación.</p>
      </div>
    </section>
    <div className={styles.campaignWrap}>{campaignConcept ? <CampaignFeature concept /> : <CampaignFeature product={summerDrop} previewOnly={previewOnly} />}</div>
    <ProductSelector products={products} error={error} previewOnly={previewOnly} />
    {flags.publicReviewsEnabled ? <section id="resenas" className={styles.reviews} aria-labelledby="reviews-title">
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>En sus propias palabras</p><h2 id="reviews-title">Lo que dicen de Luzela.</h2></div><p>Pequeños momentos.<br />Experiencias personales.</p></div>
      <div className={styles.reviewGrid}>{reviews.map(review => <figure key={review.name}><span className={styles.quoteMark} aria-hidden>“</span><blockquote>{review.quote}</blockquote><figcaption>— {review.name}</figcaption></figure>)}</div>
    </section> : null}
    <section id="historia" className={styles.story} aria-labelledby="story-title">
      <div className={styles.storyImage}><Image src="/luzela/v4/brand-story.webp" alt="Representación editorial del paisaje costero mexicano" fill sizes="(max-width: 767px) 100vw, 55vw" className={styles.coverImage} /><span>Inspiración mexicana. Espíritu de sol.</span></div>
      <div className={styles.storyCopy}><p className={styles.eyebrow}>DEL CARIBE A TU RUTINA DIARIA</p><h2 id="story-title">Belleza mexicana<br />que protege<br /><em>tu piel.</em></h2><p>Conoce la historia detrás de Luzela y los días que inspiran la marca.</p><Link href="https://about.luzela.mx" className={styles.outlineButton}>Nuestra historia <ArrowUpRight size={16} aria-hidden /></Link><p className={styles.editorialNote}>Paisaje editorial; no representa el lugar de fabricación.</p></div>
    </section>
    <div id="colaboraciones" className={styles.collaboration}><CollabFeature /></div>
    <section className={styles.confidence} aria-label="Compra con confianza">
      <div><Truck aria-hidden /><h3>Envíos a México</h3><Link href="/shipping">Consulta tiempos y condiciones</Link></div>
      <div><ShieldCheck aria-hidden /><h3>Pago seguro</h3><p>Con Mercado Pago</p></div>
      <div><PackageCheck aria-hidden /><h3>Tu pedido, contigo</h3><p>Seguimiento por correo</p></div>
      <div><MessageCircle aria-hidden /><h3>Estamos cerca</h3><Link href="/#contacto">Contacto y ayuda</Link></div>
    </section>
    <section id="preguntas" className={styles.faq} aria-labelledby="faq-title"><div><p className={styles.eyebrow}>Hablemos de tu rutina</p><h2 id="faq-title">Preguntas<br /><em>frecuentes.</em></h2><Link href="/faq" className={styles.textLink}>Más sobre Luzela <ArrowUpRight size={17} aria-hidden /></Link></div>
      <div>{faqs.map(faq => <details key={faq.question}><summary>{faq.question}<Plus size={18} aria-hidden /></summary><p>{faq.answer}</p>{faq.href ? <Link href={faq.href} className={styles.textLink}>{faq.label} <ArrowUpRight size={14} aria-hidden /></Link> : null}</details>)}</div>
    </section>
    <PublicFooter />
  </main>;
}
