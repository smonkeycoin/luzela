function Cayena({ className, id }: { className: string; id: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={className}
      data-cayena
    >
      <defs>
        <radialGradient id={`${id}-petal`} cx="50%" cy="55%" r="58%">
          <stop offset="0" stopColor="#8c143b" />
          <stop offset=".35" stopColor="#d51e54" />
          <stop offset="1" stopColor="#f06278" />
        </radialGradient>
      </defs>
      <g stroke="#a91845" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path fill={`url(#${id}-petal)`} d="M59 62C43 62 18 51 15 36C13 25 29 19 40 27C34 13 43 5 54 11C67 19 68 40 61 59C72 43 80 19 95 19C108 19 111 31 101 41C115 36 121 48 113 58C104 69 82 68 65 64C84 69 109 78 106 93C104 104 91 104 84 95C86 111 72 116 64 105C56 95 58 79 60 68C52 87 41 108 26 104C16 101 16 89 25 82C10 84 5 73 14 65C25 56 44 60 59 62Z" />
        <path d="M59 62C47 48 33 34 23 32M59 61C59 42 55 24 49 16M63 61C77 47 88 33 95 25M64 64C84 61 101 53 112 46M63 68C80 78 94 88 101 96M59 69C63 87 69 99 75 107M55 67C42 78 32 90 27 99M54 64C37 67 22 74 14 78" stroke="#f7a0ae" opacity=".65" />
        <circle cx="60" cy="64" r="7" fill="#8f173d" stroke="none" />
        <path d="M60 64C57 51 60 40 75 27" stroke="#f5c95c" strokeWidth="3" />
        <g fill="#f5c95c" stroke="none">
          <circle cx="69" cy="33" r="2.4" /><circle cx="74" cy="27" r="2.8" />
          <circle cx="77" cy="31" r="2.1" /><circle cx="65" cy="38" r="1.8" />
        </g>
      </g>
    </svg>
  );
}

export function ChavolinesPackFeature() {
  return (
    <div
      data-chavolines-feature
      className="pointer-events-none absolute -right-2 -top-2 z-20 h-[132px] w-[220px] sm:right-0 sm:top-0 sm:h-[142px] sm:w-[236px]"
    >
      <div
        className="absolute right-1 top-3 grid h-[112px] w-[202px] -rotate-[3deg] place-items-center bg-[#fffaf0] px-8 py-4 shadow-[0_5px_16px_rgba(61,45,32,.16)] sm:w-[216px]"
        style={{ clipPath: "polygon(3% 5%, 95% 0, 100% 13%, 97% 27%, 100% 42%, 97% 58%, 100% 72%, 96% 88%, 99% 98%, 74% 95%, 56% 100%, 36% 96%, 15% 100%, 0 92%, 3% 72%, 0 56%, 3% 39%, 0 20%)" }}
      >
        <p className="-rotate-1 text-center font-black uppercase leading-[.92] text-[var(--teal)] [font-family:ui-rounded,'Trebuchet_MS',sans-serif]">
          <span className="block text-[16px] tracking-[.05em]">EL FAVORITO</span>
          <span className="mt-1 block text-[13px] tracking-[.11em]">DE LOS</span>
          <span className="mt-1 block text-[20px] tracking-[.015em]">CHAVOLINES</span>
        </p>
      </div>
      <Cayena id="cayena-main" className="absolute -right-2 top-[2px] size-[64px] rotate-[10deg] drop-shadow-[0_4px_4px_rgba(134,17,55,.2)]" />
      <Cayena id="cayena-small" className="absolute -bottom-1 right-[15px] size-[48px] -rotate-[18deg] drop-shadow-[0_3px_4px_rgba(134,17,55,.18)]" />
      <span className="absolute left-[7px] top-[42px] h-5 w-3 -rotate-[34deg] rounded-[100%_0_100%_0] bg-[#e62f61] shadow-sm" />
      <span className="absolute bottom-[10px] left-[18px] h-4 w-2 rotate-[28deg] rounded-[100%_0_100%_0] bg-[#f05472] shadow-sm" />
      <p className="sr-only">
        El favorito de los Chavolines
      </p>
    </div>
  );
}
