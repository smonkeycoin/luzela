import Link from "next/link";
import { GoogleLoginButton } from "@/app/auth/login/google-button";
export const metadata = {
  title: "Acceso de colaboradores | LUZELA",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edece1] px-5">
      <section className="w-full max-w-md border border-[var(--line)] bg-white p-8 sm:p-10">
        <Link href="/" className="font-semibold tracking-[.2em]">
          LUZELA
        </Link>
        <p className="mt-10 text-xs tracking-[.15em] text-[var(--teal)]">
          COLLABORATIONS
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Un verano compartido.</h1>
        <p className="mb-8 mt-5 leading-7 text-[var(--muted)]">
          Consulta el desempeño de tu colaboración. Entra con la cuenta de
          Google asociada al correo autorizado por LUZELA.
        </p>
        {error ? (
          <p role="alert" className="mb-5 text-sm text-[var(--coral)]">
            Esta cuenta no tiene acceso a este panel. Usa el correo exacto de
            tu invitación o contacta a LUZELA.
          </p>
        ) : null}
        <GoogleLoginButton
          destination="collab"
          label={error ? "Cambiar cuenta de Google" : undefined}
        />
      </section>
    </main>
  );
}
