/**
 * The shape of a screen that has not arrived yet.
 *
 * Shown while Next is fetching a route, which is the one wait this application
 * has no other way to describe: the reads inside a screen announce themselves
 * through `ReadView`, but the moment between pressing a navigation control and
 * the new screen's own code existing belongs to the router, and without this it
 * is a blank page.
 *
 * Deliberately a rough outline rather than a faithful copy of the screen it
 * stands in for. A skeleton that mimics the real layout exactly has to be kept
 * in step with it, and the version that has drifted is worse than a plain box —
 * it promises a shape the screen no longer has.
 *
 * Hidden from screen readers entirely. There is nothing here to read, and the
 * wait is announced by the live region beside it in words.
 */
export function ScreenSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <p role="status" className="sr-only">
        Loading this screen…
      </p>

      <div aria-hidden="true" className="animate-sheen space-y-6">
        <div className="h-8 w-40 rounded-lg bg-sunken" />

        <div className="card space-y-3 p-4">
          <div className="h-3 w-24 rounded bg-sunken" />
          <div className="flex flex-wrap gap-2">
            {[64, 80, 72, 56, 68].map((width, index) => (
              <div key={index} className="h-7 rounded-full bg-sunken" style={{ width }} />
            ))}
          </div>
        </div>

        <div className="card divide-y divide-line overflow-hidden">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="space-y-2 px-4 py-4">
              <div className="h-4 rounded bg-sunken" style={{ width: `${60 - index * 5}%` }} />
              <div className="h-3 w-32 rounded bg-sunken" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
