type PaymentLogosProps = {
  compact?: boolean;
};

export function PaymentLogos({ compact = false }: PaymentLogosProps) {
  const sizeClass = compact ? "h-7 min-w-24 text-[10px]" : "h-9 min-w-32 text-xs";

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Métodos de pago">
      <span
        className={`${sizeClass} inline-flex items-center justify-center rounded-[6px] border border-[var(--line)] bg-white px-3 font-bold text-[#00a650]`}
      >
        Mercado Pago
      </span>
    </div>
  );
}
