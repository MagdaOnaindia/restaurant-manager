/**
 * Ilustración de la portada: una mesa vista desde arriba con la cuenta
 * dividiéndose entre dos móviles vía QR. Estilo flat cálido de la marca.
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 420" className={className} role="img" aria-label="Mesa de restaurante con cobro dividido por QR">
      <defs>
        <linearGradient id="hero-table" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2cfaf" />
          <stop offset="1" stopColor="#eab07d" />
        </linearGradient>
        <linearGradient id="hero-plate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d96f2a" />
          <stop offset="1" stopColor="#a1421d" />
        </linearGradient>
      </defs>

      {/* sombra suave */}
      <ellipse cx="260" cy="392" rx="215" ry="18" fill="#1c1917" opacity="0.07" />

      {/* mesa */}
      <circle cx="260" cy="205" r="165" fill="url(#hero-table)" />
      <circle cx="260" cy="205" r="150" fill="#fff7ed" />
      <circle cx="260" cy="205" r="150" fill="none" stroke="#e7d6c2" strokeWidth="2" strokeDasharray="4 8" />

      {/* plato central: el logomark en grande */}
      <circle cx="260" cy="200" r="78" fill="none" stroke="#e08748" strokeOpacity="0.35" strokeWidth="3" />
      <g>
        <path d="M260 200 L322 200 A62 62 0 0 1 260 262 Z" fill="url(#hero-plate)" transform="translate(5 5)" />
        <path d="M260 200 L260 262 A62 62 0 0 1 198 200 Z" fill="url(#hero-plate)" transform="translate(-5 5)" />
        <path d="M260 200 L198 200 A62 62 0 0 1 260 138 Z" fill="url(#hero-plate)" transform="translate(-5 -5)" />
        <path d="M260 200 L260 138 A62 62 0 0 1 322 200 Z" fill="#ffd9a8" transform="translate(14 -14)" />
        <path d="M296 158 l7 -7 m6 20 l9 -4" stroke="#c25620" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* cubiertos */}
      <g stroke="#a8a29e" strokeWidth="4" strokeLinecap="round">
        <path d="M118 168 v64 M110 168 v18 M126 168 v18 M110 186 a8 8 0 0 0 16 0" fill="none" />
        <path d="M404 168 v64 M404 168 c-9 4 -12 22 -2 30" fill="none" />
      </g>

      {/* copas */}
      <g fill="#f5f5f4" stroke="#d6d3d1" strokeWidth="2">
        <circle cx="168" cy="92" r="17" />
        <circle cx="352" cy="92" r="17" />
      </g>
      <circle cx="168" cy="92" r="9" fill="#eab07d" opacity="0.7" />
      <circle cx="352" cy="92" r="9" fill="#c25620" opacity="0.6" />

      {/* móvil izquierdo con QR */}
      <g transform="rotate(-8 118 330)">
        <rect x="70" y="272" width="96" height="150" rx="16" fill="#1c1917" />
        <rect x="76" y="278" width="84" height="138" rx="11" fill="#fafaf9" />
        {/* QR */}
        <g fill="#1c1917">
          <rect x="92" y="296" width="18" height="18" rx="2" />
          <rect x="126" y="296" width="18" height="18" rx="2" />
          <rect x="92" y="330" width="18" height="18" rx="2" />
          <rect x="96" y="300" width="10" height="10" fill="#fafaf9" />
          <rect x="130" y="300" width="10" height="10" fill="#fafaf9" />
          <rect x="96" y="334" width="10" height="10" fill="#fafaf9" />
          <rect x="126" y="330" width="8" height="8" />
          <rect x="136" y="340" width="8" height="8" />
        </g>
        <rect x="92" y="362" width="52" height="7" rx="3.5" fill="#e7e5e4" />
        <rect x="92" y="376" width="36" height="7" rx="3.5" fill="#e7e5e4" />
        <rect x="88" y="392" width="60" height="14" rx="7" fill="#c25620" />
      </g>

      {/* móvil derecho con tick de pagado */}
      <g transform="rotate(8 402 330)">
        <rect x="354" y="272" width="96" height="150" rx="16" fill="#1c1917" />
        <rect x="360" y="278" width="84" height="138" rx="11" fill="#fafaf9" />
        <circle cx="402" cy="322" r="24" fill="#dcefe3" />
        <path d="M390 322 l9 9 l16 -18" fill="none" stroke="#2f8a57" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="378" y="360" width="48" height="7" rx="3.5" fill="#e7e5e4" />
        <rect x="386" y="374" width="32" height="7" rx="3.5" fill="#e7e5e4" />
        <rect x="372" y="392" width="60" height="14" rx="7" fill="#dcefe3" />
      </g>

      {/* líneas de conexión QR → mesa */}
      <g stroke="#c25620" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 9" opacity="0.7">
        <path d="M150 290 C 185 262 205 250 222 244" fill="none" />
        <path d="M370 290 C 335 262 315 250 298 244" fill="none" />
      </g>
    </svg>
  );
}
