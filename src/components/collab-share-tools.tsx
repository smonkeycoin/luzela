"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type Copied = "code" | "campaign" | "utm" | null;

function CopyIcon({ active }: { active: boolean }) {
  return active ? (
    <Check size={17} aria-hidden />
  ) : (
    <Copy size={17} aria-hidden />
  );
}

export function CollabShareTools({
  campaignUrl,
  code,
  discount,
  utmUrl,
}: {
  campaignUrl: string;
  code: string;
  discount: number;
  utmUrl: string;
}) {
  const [copied, setCopied] = useState<Copied>(null);

  async function copy(value: string, type: Exclude<Copied, null>) {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1800);
  }

  const links: Array<[string, string, "campaign" | "utm"]> = [
    ["Link de campaña", campaignUrl, "campaign"],
    ["Link con UTM", utmUrl, "utm"],
  ];

  return (
    <section className="mt-8 rounded-2xl border border-[var(--teal)]/25 bg-white p-5 shadow-[0_14px_40px_rgba(20,123,117,.08)] sm:p-7">
      <p className="text-xs font-semibold tracking-[.2em] text-[var(--teal)]">
        TU CAMPAÑA
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
        <div className="rounded-xl bg-[#f3f0e8] p-5">
          <p className="text-xs uppercase tracking-[.14em] text-[var(--muted)]">
            Código privado
          </p>
          <p className="mt-2 break-all text-3xl font-semibold text-[var(--ink)]">
            {code}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {discount}% de descuento
          </p>
          <button
            type="button"
            onClick={() => copy(code, "code")}
            className="focus-ring mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--teal)] px-4 py-3 text-sm font-semibold text-white"
          >
            <CopyIcon active={copied === "code"} />
            {copied === "code" ? "Código copiado" : "Copiar código"}
          </button>
        </div>
        <div className="grid gap-4">
          {links.map(([label, value, type]) => (
            <div key={type} className="rounded-xl border border-[var(--line)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--muted)]">
                {label}
              </p>
              <p className="mt-2 break-all text-sm leading-6">{value}</p>
              <button
                type="button"
                onClick={() => copy(value, type)}
                className="focus-ring mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--teal)] underline underline-offset-4"
              >
                <CopyIcon active={copied === type} />
                {copied === type ? "Link copiado" : "Copiar link"}
              </button>
            </div>
          ))}
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? "Copiado al portapapeles" : ""}
      </p>
    </section>
  );
}
