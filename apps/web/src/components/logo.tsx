import { clsx } from "clsx";

/**
 * Logomark de Restaurant Manager: un plato visto desde arriba partido en
 * cuartos, con una porción separada — "cada uno paga lo suyo".
 */
export function Logomark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={clsx("h-8 w-8", className)}
      role="img"
      aria-label="Restaurant Manager"
    >
      <defs>
        <linearGradient id="rm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d96f2a" />
          <stop offset="1" stopColor="#a1421d" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="12" fill="url(#rm-bg)" />
      {/* plato: aro exterior sutil */}
      <circle cx="23" cy="25" r="15.5" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.5" />
      {/* tres cuartos del plato */}
      <path d="M23 25 L36 25 A13 13 0 0 1 23 38 Z" fill="#fff7ed" transform="translate(1.2 1.2)" />
      <path d="M23 25 L23 38 A13 13 0 0 1 10 25 Z" fill="#fff7ed" transform="translate(-1.2 1.2)" />
      <path d="M23 25 L10 25 A13 13 0 0 1 23 12 Z" fill="#fff7ed" transform="translate(-1.2 -1.2)" />
      {/* la porción "pagada", separada */}
      <path d="M23 25 L23 12 A13 13 0 0 1 36 25 Z" fill="#ffd9a8" transform="translate(3.6 -3.6)" />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  dark = false,
}: {
  className?: string;
  markClassName?: string;
  dark?: boolean;
}) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <Logomark className={markClassName} />
      <span
        className={clsx(
          "font-serif text-lg font-semibold leading-none tracking-tight",
          dark ? "text-white" : "text-neutral-900",
        )}
      >
        Restaurant
        <span className={dark ? "text-amber-200" : "text-brand-600"}> Manager</span>
      </span>
    </span>
  );
}
