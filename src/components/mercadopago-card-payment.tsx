"use client";

import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { trackCommerce } from "@/lib/analytics/client";

type BrickStatus = "loading" | "ready" | "error";
type CardPaymentProps = ComponentProps<typeof CardPayment>;
type CardPaymentFormData = Parameters<CardPaymentProps["onSubmit"]>[0];
type CardPaymentAdditionalData = Parameters<CardPaymentProps["onSubmit"]>[1];
type BrickError = NonNullable<CardPaymentProps["onError"]> extends (error: infer ErrorType) => void
  ? ErrorType
  : unknown;

function sanitizeBrickError(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      code: "unknown",
      message: typeof error === "string" ? error : "unknown_error",
    };
  }

  const maybeError = error as { cause?: unknown; message?: unknown; type?: unknown };

  return {
    code: typeof maybeError.cause === "string" ? maybeError.cause : "unknown",
    message:
      typeof maybeError.message === "string" ? maybeError.message : "unknown_error",
    type: typeof maybeError.type === "string" ? maybeError.type : undefined,
  };
}

function reportMercadoPagoIssue(stage: string, error: unknown) {
  const sanitized = sanitizeBrickError(error);

  console.error("Mercado Pago Brick error", {
    stage,
    code: sanitized.code,
    message: sanitized.message,
    type: sanitized.type,
  });

  return sanitized;
}

function formatCheckoutAmount(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    currency: "MXN",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

const CARD_BRANDS = ["Visa", "Mastercard", "American Express"];
const MERCADOPAGO_MARK_SRC =
  "https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/7.4.9/mercadopago/favicon.svg";

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
  const router = useRouter();
  const [status, setStatus] = useState<BrickStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const validAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const ctaLabel = submitting
    ? "Procesando pago..."
    : validAmount
      ? `Pagar ${formatCheckoutAmount(validAmount)}`
      : "Pagar";

  useEffect(() => {
    if (!publicKey || !validAmount) {
      return;
    }

    try {
      initMercadoPago(publicKey, { locale: "es-MX" });
    } catch (error) {
      reportMercadoPagoIssue("sdk-init", error);
    }
  }, [publicKey, validAmount]);

  useEffect(() => {
    if (!publicKey || !validAmount || status !== "loading") {
      return undefined;
    }

    const container = document.getElementById("mercadopago-card-payment");

    if (!container) {
      return undefined;
    }

    function markReadyWhenRendered() {
      const brickContainer = document.getElementById("mercadopago-card-payment");
      const hasSkeleton = Boolean(
        brickContainer?.querySelector('[data-testid="skeleton-form"]'),
      );
      const hasSecureFrames = (brickContainer?.querySelectorAll("iframe").length ?? 0) > 0;

      if (hasSecureFrames && !hasSkeleton) {
        setStatus("ready");
        setMessage(null);
        trackCommerce("payment_page_viewed", {}, `payment_page_viewed:${checkoutSessionId}`);
      }
    }

    const initialCheck = window.setTimeout(markReadyWhenRendered, 0);

    const observer = new MutationObserver(markReadyWhenRendered);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(initialCheck);
      observer.disconnect();
    };
  }, [checkoutSessionId, publicKey, status, validAmount]);

  useEffect(() => {
    if (!validAmount || status === "error") {
      return undefined;
    }

    function updateButtonLabel() {
      const container = document.getElementById("mercadopago-card-payment");
      const buttons = Array.from(container?.querySelectorAll("button") ?? []);
      const submitButton = buttons.find((button) =>
        /pagar/i.test(button.textContent || ""),
      );

      if (submitButton && submitButton.textContent !== ctaLabel) {
        submitButton.textContent = ctaLabel;
        submitButton.setAttribute("aria-label", ctaLabel);
      }

      if (submitButton) {
        submitButton.disabled = submitting;
        submitButton.setAttribute("aria-busy", submitting ? "true" : "false");
      }
    }

    const container = document.getElementById("mercadopago-card-payment");
    updateButtonLabel();

    if (!container) {
      return undefined;
    }

    const observer = new MutationObserver(updateButtonLabel);
    observer.observe(container, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [ctaLabel, status, submitting, validAmount]);

  const initialization = useMemo(
    () => ({
      amount: validAmount,
      payer: email ? { email } : undefined,
    }),
    [email, validAmount],
  );

  const customization = useMemo<NonNullable<CardPaymentProps["customization"]>>(
    () => ({
      paymentMethods: {
        minInstallments: 1,
        maxInstallments: 1,
        types: {
          included: ["credit_card", "debit_card"],
        },
      },
      visual: {
        hideFormTitle: true,
        style: {
          theme: "default",
          customVariables: {
            baseColor: "#147b75",
            borderRadiusMedium: "8px",
          },
        },
      },
    }),
    [],
  );

  const handleReady = useCallback(() => {
    setStatus("ready");
    setMessage(null);
    trackCommerce("payment_page_viewed", {}, `payment_page_viewed:${checkoutSessionId}`);
  }, [checkoutSessionId]);

  const handleError = useCallback((error: BrickError) => {
    const sanitized = reportMercadoPagoIssue("brick-render", error);

    setStatus("error");
    setMessage(
      `Mercado Pago no pudo renderizar el formulario (${sanitized.code}: ${sanitized.message}).`,
    );
  }, []);

  const handleSubmit = useCallback(
    (formData: CardPaymentFormData, additionalData?: CardPaymentAdditionalData) =>
      new Promise<void>((resolve, reject) => {
        if (submittingRef.current) {
          const error = new Error("payment_attempt_in_progress");

          setMessage("Procesando pago...");
          reject(error);
          return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setMessage("Procesando pago...");
        trackCommerce("payment_submitted", {});

        fetch("/api/mercadopago/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            checkout_session_id: checkoutSessionId,
            token: formData.token,
            payment_method_id: formData.payment_method_id,
            payment_method_type: additionalData?.paymentTypeId,
            installments: formData.installments,
            payer: formData.payer,
          }),
        })
          .then(async (response) => {
            const body = (await response.json().catch(() => ({}))) as {
              error?: string;
              next_url?: string;
            };

            if (!response.ok) {
              throw new Error(body.error || "No pudimos procesar el pago.");
            }

            setMessage("Pago recibido. Confirmaremos tu orden por webhook seguro.");
            router.push(`${body.next_url || "/checkout/success"}?checkout_session=${encodeURIComponent(checkoutSessionId)}`);
            resolve();
          })
          .catch((error) => {
            reportMercadoPagoIssue("order-submit", error);
            setMessage(
              error instanceof Error ? error.message : "No pudimos procesar el pago.",
            );
            submittingRef.current = false;
            setSubmitting(false);
            reject(error);
          });
      }),
    [checkoutSessionId, router],
  );

  if (!publicKey) {
    return (
      <div className="rounded-[8px] border border-[var(--line)] bg-white p-5 text-sm font-semibold text-[var(--coral)]">
        Mercado Pago no está configurado para este ambiente.
      </div>
    );
  }

  if (!validAmount) {
    return (
      <div className="rounded-[8px] border border-[var(--line)] bg-white p-5 text-sm font-semibold text-[var(--coral)]">
        El monto de pago no es válido.
      </div>
    );
  }

  return (
    <div className="grid gap-4" data-testid="mercadopago-card-payment">
      <div className="rounded-[8px] border border-[var(--line)] bg-white px-4 py-4 sm:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
          PAGO CON TARJETA
        </p>
        <div
          className="mt-3 inline-flex items-center gap-2"
          aria-label="Mercado Pago"
          data-testid="mercadopago-branding"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MERCADOPAGO_MARK_SRC}
            alt="Mercado Pago"
            className="h-6 w-6 shrink-0"
            decoding="async"
          />
          <span className="text-sm font-bold text-[#071b8c]">Mercado Pago</span>
        </div>
        <div className="mt-3 flex items-start gap-3">
          <ShieldCheck
            aria-hidden
            className="mt-0.5 shrink-0 text-[var(--teal)]"
            size={18}
          />
          <div>
            <p className="text-sm font-semibold text-[var(--ink)]">
              Crédito o débito
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Procesado de forma segura por Mercado Pago. No necesitas una cuenta
              Mercado Pago para pagar con tarjeta.
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Tus datos de tarjeta son procesados directamente por Mercado Pago. Luzela no
              almacena esta información.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-[var(--ink)]">
          Tarjeta de crédito o débito
        </h2>
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="Tarjetas aceptadas"
          data-testid="card-brand-logos"
        >
          {CARD_BRANDS.map((brand) => (
            <span
              className="inline-flex h-7 items-center rounded-[6px] border border-[var(--line)] bg-white px-2.5 text-[10px] font-bold uppercase text-[var(--ink)]"
              key={brand}
            >
              {brand}
            </span>
          ))}
        </div>
      </div>

      {status === "loading" ? (
        <div
          className="rounded-[8px] border border-[var(--line)] bg-white p-5 text-sm font-semibold text-[var(--muted)]"
          data-testid="mercadopago-loading"
        >
          Cargando Mercado Pago...
        </div>
      ) : null}

      <CardPayment
        id="mercadopago-card-payment"
        initialization={initialization}
        customization={customization}
        locale="es-MX"
        onReady={handleReady}
        onError={handleError}
        onSubmit={handleSubmit}
      />

      <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
        <ShieldCheck size={16} className="text-[var(--teal)]" aria-hidden />
        Visa · Mastercard · American Express · Procesado por Mercado Pago
      </p>

      {message ? (
        <p
          className="rounded-[8px] border border-[var(--line)] bg-white p-3 text-sm font-semibold text-[var(--muted)]"
          data-testid={status === "error" ? "mercadopago-error" : undefined}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
