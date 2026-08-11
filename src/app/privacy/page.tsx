import { InfoPage } from "@/components/info-page";

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="Políticas" title="Privacidad">
      <section className="surface rounded-[8px] p-5">
        <h2 className="text-base font-semibold text-[var(--ink)]">Aviso en preparación</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Pendiente de aprobación legal. Esta página debe recibir el aviso de
          privacidad final antes de producción.
        </p>
        {/* TODO: Replace with Luzela-approved privacy policy. */}
      </section>
    </InfoPage>
  );
}
