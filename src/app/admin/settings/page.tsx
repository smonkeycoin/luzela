export default function AdminSettingsPage() {
  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <section className="surface mt-6 rounded-[8px] p-5">
        <p className="text-sm leading-6 text-[var(--muted)]">
          app_settings centralizara moneda, umbral de stock bajo, politicas de
          envio, remitentes Resend y flags de funcionalidades.
        </p>
      </section>
    </main>
  );
}
