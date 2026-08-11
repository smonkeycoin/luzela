import Link from "next/link";

import { GoogleLoginButton } from "./google-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const { error, reason } = await searchParams;
  const message =
    error === "access_denied" || reason === "not_admin"
      ? "Access denied. Tu cuenta Google no esta autorizada para administrar Luzela."
      : error
        ? "No pudimos completar el inicio de sesion. Intenta de nuevo."
        : null;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="surface w-full max-w-md rounded-[8px] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
          Luzela Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--ink)]">
          Iniciar sesion
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Acceso exclusivo para el equipo autorizado en `admin_users`.
        </p>
        {message ? (
          <div className="mt-5 rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--coral)]">
            {message}
          </div>
        ) : null}
        <div className="mt-6">
          <GoogleLoginButton />
        </div>
        <Link
          href="/"
          className="focus-ring mt-5 inline-flex text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Volver a la tienda
        </Link>
      </section>
    </main>
  );
}
