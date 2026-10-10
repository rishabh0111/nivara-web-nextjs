/**
 * The product mark: a speech bubble cut from the accent square, the same
 * geometry as the icon this application serves and the one on the product
 * page. Filled with the system accent and stroked in the accent's own ink,
 * never white on orange.
 *
 * Decorative wherever it appears beside the name, which is why it is hidden:
 * the words "Nivara Desk" are always written next to it.
 */
export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={`${className} shrink-0`}>
      <rect width="32" height="32" rx="7" style={{ fill: "var(--accent)" }} />
      <path
        d="M25 18.5a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4.5V9.5A2.5 2.5 0 0 1 9 7h13.5A2.5 2.5 0 0 1 25 9.5Z"
        fill="none"
        style={{ stroke: "var(--accent-ink)" }}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The mark and the name, which is what every bar wants. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 font-medium tracking-tight ${className}`}>
      <Logo />
      <span className="truncate">Nivara Desk</span>
    </span>
  );
}
