import type { ReactNode } from "react";

import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

type InfoPageProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function InfoPage({ eyebrow, title, children }: InfoPageProps) {
  return (
    <main className="min-h-screen">
      <PublicHeader />
      <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-[var(--ink)] sm:text-4xl">
          {title}
        </h1>
        <div className="mt-8 grid gap-5">{children}</div>
      </section>
      <PublicFooter />
    </main>
  );
}
