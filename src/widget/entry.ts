/**
 * The bundle a Tenant's page loads. The only module with a side effect.
 *
 * `document.currentScript` is read here, at the top level, and nowhere else: it
 * is the executing script only while the script is executing, and is null from
 * inside any callback. Reading it late is the classic way a snippet loses the
 * configuration it was pasted with.
 */
import { bootWidget } from "./boot";

const script = document.currentScript as HTMLScriptElement | null;

function start(): void {
  try {
    bootWidget({ script });
  } catch (cause) {
    // A boot that cannot proceed is an install problem on somebody else's site,
    // and their console is where it gets fixed. It is never thrown onward: an
    // uncaught error from an embedded script is a stranger's page reporting a
    // fault that is not theirs.
    console.error(cause);
  }
}

// `document.body` is where the host element goes, and a Snippet in the head has
// not got one yet. Deferred rather than required to be placed correctly, because
// where the Snippet lands is the Tenant's choice and both places are reasonable.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
