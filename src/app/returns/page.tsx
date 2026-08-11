import { InfoPage } from "@/components/info-page";

export default function ReturnsPage() {
  return (
    <InfoPage eyebrow="Ayuda" title="Cambios y devoluciones">
      <section className="surface rounded-[8px] p-5">
        <h2 className="text-base font-semibold text-[var(--ink)]">Política en preparación</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Pendiente de aprobación comercial y legal. Esta página debe recibir la
          política final antes de producción.
        </p>
        {/* TODO: Replace with Luzela-approved returns policy. */}
      </section>
    </InfoPage>
  );
}
