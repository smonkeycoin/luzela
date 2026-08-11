import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="surface w-full max-w-md rounded-[8px] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--coral)]">
          Access denied
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--ink)]">
          Cuenta no autorizada
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Tu Google login funciono, pero esta cuenta no aparece activa en
          `admin_users`. La sesion fue cerrada.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/auth/login?error=access_denied"
            className="focus-ring inline-flex h-11 items-center justify-center rounded-[8px] bg-[var(--ink)] px-4 text-sm font-semibold text-white"
          >
            Intentar otra cuenta
          </Link>
          <Link
            href="/"
            className="focus-ring inline-flex h-11 items-center justify-center rounded-[8px] border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--ink)]"
          >
            Volver
          </Link>
        </div>
      </section>
    </main>
  );
}
