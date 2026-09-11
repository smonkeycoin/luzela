function Cayena({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={className}
      data-cayena
    >
      <g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        <path fill="currentColor" fillOpacity=".12" d="M57 64C42 62 18 49 16 34C14 23 30 19 39 25C35 12 44 5 53 10C65 17 67 38 60 60C71 44 78 19 93 18C104 18 108 28 100 38C113 34 119 44 113 53C104 65 82 67 64 65C83 68 109 74 108 91C108 101 96 104 88 97C91 111 79 118 70 110C60 102 58 82 60 69C54 87 46 111 30 108C20 107 18 96 25 88C11 92 5 82 12 73C23 61 43 62 57 64Z" />
        <path d="M57 62C48 48 32 30 24 29M57 61C59 41 54 23 48 15M62 62C77 48 87 35 92 26M63 65C83 60 100 52 109 45M62 68C80 79 92 86 101 92M59 70C65 86 71 98 77 105M55 67C41 78 31 93 29 100M54 64C35 68 22 76 16 80" />
        <path d="M59 65C51 57 53 42 70 28" strokeWidth="2" />
        <path d="M64 36L60 29M68 31L66 23M70 28L75 25" />
        <g fill="currentColor" stroke="none">
          <circle cx="60" cy="28" r="2" /><circle cx="66" cy="22" r="2" />
          <circle cx="75" cy="25" r="2.3" /><circle cx="58" cy="36" r="1.5" />
        </g>
      </g>
    </svg>
  );
}

export function ChavolinesPackFeature() {
  return (
    <div
      data-chavolines-feature
      className="relative isolate flex min-h-[88px] items-center justify-end overflow-hidden border-x border-t border-[var(--teal)]/30 bg-[#faf8f3] px-4 py-3"
    >
      <Cayena className="pointer-events-none absolute -left-2 -top-3 size-[112px] -rotate-12 text-[#ba4d68] opacity-30" />
      <Cayena className="pointer-events-none absolute bottom-0 left-[76px] size-[62px] rotate-[22deg] text-[#d57869] opacity-25" />
      <p className="relative text-right font-semibold uppercase leading-tight text-[var(--teal)]">
        <span className="block text-[10px] tracking-[.19em]">EL FAVORITO</span>
        <span className="mt-1 block text-[9px] tracking-[.19em]">DE LOS</span>
        <span className="mt-1 block text-[15px] tracking-[.08em]">CHAVOLINES</span>
      </p>
    </div>
  );
}
