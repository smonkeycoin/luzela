"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale?: string },
    ) => {
      bricks: () => {
        create: (
          brick: "cardPayment",
          containerId: string,
          settings: Record<string, unknown>,
        ) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

export function MercadoPagoCardPayment({
  amount,
  checkoutSessionId,
  email,
  publicKey,
}: {
  amount: number;
  checkoutSessionId: string;
  email: string;
  publicKey: string;
}) {
  const controllerRef = useRef<{ unmount: () => void } | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!sdkReady || !publicKey || !window.MercadoPago || controllerRef.current) {
      return undefined;
    }

    const mercadoPago = new window.MercadoPago(publicKey, { locale: "es-MX" });
    const bricksBuilder = mercadoPago.bricks();
    let mounted = true;

    bricksBuilder
      .create("cardPayment", "mercadopago-card-payment", {
        initialization: {
          amount,
          payer: {
            email,
          },
        },
        callbacks: {
          onSubmit: (formData: Record<string, unknown>, additionalData: Record<string, unknown>) =>
            new Promise<void>((resolve, reject) => {
              fetch("/api/mercadopago/order", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  checkout_session_id: checkoutSessionId,
                  token: formData.token,
                  payment_method_id: formData.payment_method_id,
                  payment_method_type: additionalData.paymentTypeId,
                  installments: formData.installments,
                  payer: formData.payer,
                }),
              })
                .then(async (response) => {
                  const body = await response.json().catch(() => ({}));

                  if (!response.ok) {
                    throw new Error(body.error || "No pudimos procesar el pago.");
                  }

                  setMessage("Pago recibido. Confirmaremos tu orden por webhook seguro.");
                  window.location.assign(body.next_url || "/checkout/success");
                  resolve();
                })
                .catch((error) => {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : "No pudimos procesar el pago.",
                  );
                  reject(error);
                });
            }),
          onError: () => {
            setMessage("Revisa los datos de pago e inténtalo de nuevo.");
          },
        },
      })
      .then((controller) => {
        if (mounted) {
          controllerRef.current = controller;
        } else {
          controller.unmount();
        }
      })
      .catch(() => {
        setMessage("No pudimos cargar Mercado Pago.");
      });

    return () => {
      mounted = false;
      controllerRef.current?.unmount();
      controllerRef.current = null;
    };
  }, [amount, checkoutSessionId, email, publicKey, sdkReady]);

  if (!publicKey) {
    return (
      <div className="rounded-[8px] border border-[var(--line)] bg-white p-5 text-sm font-semibold text-[var(--coral)]">
        Mercado Pago no está configurado para este ambiente.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />
      <div id="mercadopago-card-payment" className="min-h-[420px]" />
      {message ? (
        <p className="rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--muted)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
