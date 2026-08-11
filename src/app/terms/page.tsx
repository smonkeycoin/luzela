import { InfoPage } from "@/components/info-page";

export default function TermsPage() {
  return (
    <InfoPage eyebrow="Políticas" title="Términos y condiciones">
      <section className="surface rounded-[8px] p-5">
        <h2 className="text-base font-semibold text-[var(--ink)]">Documento en preparación</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Pendiente de aprobación legal. Esta página debe recibir los términos
          finales antes de producción.
        </p>
        {/* TODO: Replace with Luzela-approved terms and conditions. */}
      </section>
    </InfoPage>
  );
}
