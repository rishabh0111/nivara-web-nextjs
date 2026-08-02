/**
 * The way out of a screen that replaced another one.
 *
 * Written once because three Surfaces each have one, and because the arrow is
 * the part that keeps being forgotten: "All tickets" on its own is a
 * destination, and a reader has to have learned that it is also the way back.
 * The arrow says which direction the word goes in.
 *
 * The arrow is decorative and marked as such — the accessible name stays the
 * words alone, so what a screen reader announces is what the button does rather
 * than "left arrow, All tickets".
 */
export function BackLink({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="link inline-flex items-center gap-1.5 text-sm"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
      >
        <path d="M19 12H5M11 18l-6-6 6-6" />
      </svg>
      {children}
    </button>
  );
}
