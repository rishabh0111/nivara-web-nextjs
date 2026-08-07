/**
 * The Widget's appearance, and the reset that makes it survive a stranger's
 * stylesheet.
 *
 * Plain CSS in a string rather than the Tailwind the rest of this repository
 * uses, because the Tailwind sheet lives in the Next application's document and
 * a shadow root cannot see it. Injecting the whole sheet in here to get a dozen
 * utilities would be most of the size budget spent on classes nobody uses.
 */

/**
 * **Load-bearing. Do not remove as redundant.**
 *
 * A shadow root stops a host page's *selectors* reaching in, and that is all it
 * stops. Inherited properties — colour, font, line height, letter spacing,
 * direction — cross the boundary through the host element as if it were not
 * there, so a Tenant's `body { font-family: Papyrus }` styles this Widget
 * unless something says otherwise. `all: initial` on the host is that
 * something: every inheritable property starts again at the boundary.
 *
 * `all: initial` cannot win against an `!important` rule the host page aims at
 * the host element, and no reset can. So the defence is two-deep: the boundary
 * is reset, and then every visible part of the Widget states its own font and
 * colour rather than inheriting one. An outer selector cannot match those
 * elements at all, `!important` or not.
 */
const RESET = `
:host {
  all: initial;
  position: fixed;
  inset: auto 1rem 1rem auto;
  z-index: 2147483000;
  display: block;
  color-scheme: light;
}
`;

const WIDGET = `
.nvw {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 15px;
  font-weight: 400;
  font-style: normal;
  line-height: 1.5;
  letter-spacing: normal;
  text-align: left;
  text-transform: none;
  color: #131a26;
  direction: ltr;
  box-sizing: border-box;
}

.nvw *,
.nvw *::before,
.nvw *::after {
  box-sizing: inherit;
}

.nvw-launcher {
  font: inherit;
  color: #ffffff;
  background: #1d63c4;
  border: 0;
  border-radius: 9999px;
  padding: 0.75rem 1.25rem;
  cursor: pointer;
  box-shadow: 0 6px 20px rgb(19 26 38 / 0.22);
}

.nvw-launcher:hover {
  background: #17509f;
}

.nvw-launcher:focus-visible {
  outline: 3px solid #1d63c4;
  outline-offset: 2px;
}

.nvw-launcher[aria-busy="true"] {
  cursor: progress;
  opacity: 0.8;
}

.nvw-panel {
  width: min(22rem, calc(100vw - 2rem));
  /* Dynamic viewport height rather than plain vh: a phone browser's address bar
     counts towards vh and is not part of the screen, so a panel sized that way
     puts its composer underneath the bar, exactly where somebody is typing. */
  max-height: min(32rem, calc(100dvh - 2rem));
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid #e3e7ed;
  border-radius: 0.75rem;
  box-shadow: 0 12px 40px rgb(19 26 38 / 0.22);
  overflow: hidden;
}

/*
  A panel with a conversation in it takes its whole height, so the composer sits
  at the bottom and the thread scrolls above it rather than pushing it down the
  page. A panel with one sentence in it — the gate's refusal — sizes to that
  sentence: a full-height box holding one line reads as something that failed to
  load.
*/
.nvw-panel-live {
  height: min(32rem, calc(100dvh - 2rem));
}

.nvw-panel:focus-visible {
  outline: 3px solid #1d63c4;
  outline-offset: 2px;
}

.nvw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e3e7ed;
}

.nvw-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
}

.nvw-close {
  font: inherit;
  color: #5a6675;
  background: transparent;
  border: 0;
  border-radius: 0.375rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
}

.nvw-close:hover {
  background: #f1f3f6;
}

.nvw-close:focus-visible {
  outline: 2px solid #1d63c4;
  outline-offset: 1px;
}

.nvw-back {
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #1d63c4;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #e3e7ed;
  padding: 0.5rem 1rem;
  cursor: pointer;
  text-align: left;
  flex: 0 0 auto;
}

.nvw-back:hover {
  background: #f6f7f9;
}

.nvw-back:focus-visible,
.nvw-more:focus-visible,
.nvw-row:focus-visible,
.nvw-secondary:focus-visible,
.nvw-send:focus-visible,
.nvw-box:focus-visible {
  outline: 2px solid #1d63c4;
  outline-offset: 1px;
}

.nvw-body {
  /* The panel is a fixed height and this is the part that gives — so the
     composer stays put at the bottom while the conversation scrolls above it,
     which is what makes this read as a chat rather than as a long page. */
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  overflow-y: auto;
}

.nvw-quiet {
  color: #5a6675;
  margin: 0;
}

.nvw-refusal {
  color: #131a26;
  margin: 0;
}

.nvw-problem {
  color: #b3261e;
  margin: 0;
}

.nvw-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1 1 auto;
  min-height: 0;
}

.nvw-greeting {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
}

.nvw-standing {
  color: #5a6675;
  font-size: 13px;
  margin: 0;
}

.nvw-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nvw-row {
  font: inherit;
  color: inherit;
  width: 100%;
  display: block;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
}

.nvw-row:hover {
  background: #f1f3f6;
}

.nvw-row-subject {
  display: block;
  font-weight: 600;
}

.nvw-row-note {
  display: block;
  color: #5a6675;
  font-size: 13px;
}

.nvw-more,
.nvw-secondary {
  font: inherit;
  color: #131a26;
  background: transparent;
  border: 1px solid #cbd3de;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}

.nvw-more:hover,
.nvw-secondary:hover {
  background: #f1f3f6;
}

.nvw-thread {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.nvw-said {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nvw-mine,
.nvw-theirs {
  border-radius: 0.75rem;
  padding: 0.5rem 0.75rem;
  max-width: 85%;
}

/* Who said it, told twice: the name is written out for a reader who cannot see
   the alignment, and the alignment is there for a reader who is not going to
   read four names to follow a conversation. */
.nvw-mine {
  align-self: flex-end;
  background: #1d63c4;
  color: #ffffff;
}

.nvw-theirs {
  align-self: flex-start;
  background: #f1f3f6;
  color: #131a26;
}

.nvw-who {
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 0.125rem;
  opacity: 0.85;
}

.nvw-body-text {
  margin: 0;
  /* Verbatim, so somebody's line breaks survive and their long word does not
     push the panel wider than the phone it is on. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.nvw-compose {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 0 0 auto;
}

/* Named for a screen reader, invisible to the eye. Not display:none, which
   would take it out of the accessibility tree along with the pixels. */
.nvw-only-spoken {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.nvw-box {
  font: inherit;
  color: #131a26;
  background: #ffffff;
  width: 100%;
  border: 1px solid #cbd3de;
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  resize: vertical;
}

.nvw-outcome {
  color: #5a6675;
  font-size: 13px;
  margin: 0;
}

/*
  The live regions are rendered whether or not they have anything to say, so a
  screen reader is already watching them when the text arrives — a region
  inserted at the same moment as its content is frequently not announced. Empty,
  they should take no room, which is a thing to hide rather than not to render.
*/
.nvw-compose > p:empty {
  display: none;
}

.nvw-send {
  font: inherit;
  color: #ffffff;
  background: #1d63c4;
  border: 0;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  align-self: flex-start;
}

.nvw-send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/*
  A phone. The panel takes the screen, because a 22rem card floating in the
  corner of a 375px viewport is a card with a composer too small to type in —
  and support is asked for from a phone more often than from anything else.
*/
@media (max-width: 30rem) {
  :host {
    inset: auto 0.5rem 0.5rem auto;
  }

  .nvw-panel {
    width: calc(100vw - 1rem);
    max-height: calc(100dvh - 1rem);
  }

  .nvw-panel-live {
    height: calc(100dvh - 1rem);
  }
}

/*
  Motion, and the one rule that turns it off.

  Kept to what a press or a hover needs — a colour settling, a panel arriving —
  because this renders on somebody else's page and a Widget that animates more
  than the site around it reads as an advert rather than as support. The panel's
  entrance is short and travels a few pixels; anything longer makes a reader
  wait for a box they already asked for.
*/
.nvw-launcher,
.nvw-close,
.nvw-row,
.nvw-more,
.nvw-secondary,
.nvw-send,
.nvw-box,
.nvw-back {
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.nvw-launcher:hover {
  box-shadow: 0 8px 24px rgb(19 26 38 / 0.3);
}

.nvw-box:focus-visible {
  border-color: #1d63c4;
}

.nvw-panel {
  animation: nvw-arrive 180ms ease-out;
}

@keyframes nvw-arrive {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

/* A host page that asked for less motion gets less, and the reset is total
   rather than per-rule: whatever is added above, this turns it off. */
@media (prefers-reduced-motion: reduce) {
  .nvw,
  .nvw * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }

  .nvw-panel {
    animation: none;
  }
}
`;

/** The reset first, so the Widget's own rules are written over a clean slate. */
export function widgetStyles(): string {
  return `${RESET}${WIDGET}`;
}
