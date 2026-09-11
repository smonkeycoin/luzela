"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";

type ConfirmRule = {
  field: string;
  when: "checked" | "unchecked";
  title: string;
  body: string;
};

export function SettingsForm({
  action,
  children,
  confirmRules = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  confirmRules?: ConfirmRule[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmRule | null>(null);

  return (
    <>
      <form
        ref={formRef}
        action={action}
        className="grid gap-4"
        onChange={() => setDirty(true)}
        onSubmit={(event) => {
          if (confirmedRef.current) {
            confirmedRef.current = false;
            return;
          }

          const form = event.currentTarget;
          const rule = confirmRules.find((candidate) => {
            const field = form.elements.namedItem(candidate.field);

            if (!(field instanceof HTMLInputElement) || field.type !== "checkbox") {
              return false;
            }

            return candidate.when === "checked" ? field.checked : !field.checked;
          });

          if (rule) {
            event.preventDefault();
            setConfirmation(rule);
          }
        }}
      >
        {dirty ? (
          <p className="rounded-[8px] border border-[#e8ddc2] bg-[#fffaf0] px-3 py-2 text-xs font-semibold text-[#7a5b20]">
            Cambios sin guardar
          </p>
        ) : null}
        {children}
      </form>

      {confirmation ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="settings-confirm-title"
        >
          <div className="w-full max-w-md rounded-[8px] border border-[var(--line)] bg-white p-5 shadow-xl">
            <h3 id="settings-confirm-title" className="text-lg font-semibold text-[var(--ink)]">
              {confirmation.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{confirmation.body}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="focus-ring h-10 rounded-[8px] border border-[var(--line)] px-4 text-sm font-semibold text-[var(--ink)]"
                onClick={() => setConfirmation(null)}
              >
                Revisar cambios
              </button>
              <button
                type="button"
                className="focus-ring h-10 rounded-[8px] bg-[var(--ink)] px-4 text-sm font-semibold text-white"
                onClick={() => {
                  confirmedRef.current = true;
                  setConfirmation(null);
                  formRef.current?.requestSubmit();
                }}
              >
                Confirmar y guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
