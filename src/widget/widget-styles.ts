/**
 * The Widget's appearance, and the reset that makes it survive a stranger's
 * stylesheet.
 *
 * Plain CSS in a string rather than the Tailwind the rest of this repository
 * uses, because the Tailwind sheet lives in the Next application's document and
 * a shadow root cannot see it. Injecting the whole sheet in here to get a dozen
 * utilities would be most of the size budget spent on classes nobody uses.
 *
 * The values are the product's own (`nivara-landing/DESIGN.md`, and the same
 * tokens as `src/app/globals.css`): graphite, one safety orange, Work Sans. The
 * orange is spent on the Launcher and the Send button (the actions) and on the
 * hand-over, and on nothing else. The ruling under each of Automation's turns
 * is the system's signature strip at the size of a chat.
 */

import { WIDGET_FACE } from "./widget-face";

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
  color-scheme: light dark;
}
`;

/**
 * The system's roles, light then dark. Dark follows the reader's own setting:
 * the Snippet carries one attribute and a theme is not it (`widget-config.ts`),
 * and a shadow root cannot read the host page's choice.
 */
const TOKENS = `
.nvw {
  --ground: #eff0f1;
  --frame: #f4f5f6;
  --sheet: #ffffff;
  --sheet-step: #eceef0;
  --raised: #d5d8db;
  --edge: #d9dbde;
  --control-edge: #b9bdc2;
  --ink: #18191b;
  --muted: #55585e;
  --accent: #ff4a1f;
  --accent-strong: #e8380f;
  --accent-ink: #18191b;
  --accent-text: #c2300c;
  --go: #17804f;
  --go-wash: #dcf1e6;
  --ask: #8a6500;
  --ask-wash: #f6ecc9;
  --danger: #b42318;
  --danger-wash: #fde8e6;
  --float: 0 2px 4px rgb(24 25 27 / 0.08), 0 16px 40px rgb(24 25 27 / 0.18);
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-color-scheme: dark) {
  .nvw {
    --ground: #18191b;
    --frame: #1c1d20;
    --sheet: #222427;
    --sheet-step: #2f3236;
    --raised: #3a3d42;
    --edge: #383b40;
    --control-edge: #4f535a;
    --ink: #eff0f1;
    --muted: #a3a5aa;
    --accent-strong: #ff6a45;
    --accent-text: #ff6a45;
    --go: #4cc98a;
    --go-wash: #173426;
    --ask: #e6b84a;
    --ask-wash: #3a3016;
    --danger: #ff8a7a;
    --danger-wash: #3a1a17;
    --float: 0 2px 4px rgb(0 0 0 / 0.3), 0 16px 40px rgb(0 0 0 / 0.5);
  }
}
`;

const WIDGET = `
.nvw {
  /* Work Sans once the Visitor has asked for support (\`widget-face.ts\`);
     until then, and wherever the host page refuses the font, the reader's own
     system face. Chosen, not inherited: the host's face never gets in. */
  font-family: "${WIDGET_FACE}", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 15px;
  font-weight: 400;
  font-style: normal;
  line-height: 1.45;
  letter-spacing: normal;
  text-align: left;
  text-transform: none;
  color: var(--ink);
  direction: ltr;
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;

  /* The Launcher and anything it has to say about itself, stacked from the
     corner up. */
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.nvw *,
.nvw *::before,
.nvw *::after {
  box-sizing: inherit;
}

.nvw ::selection {
  background: var(--accent);
  color: var(--accent-ink);
}

.nvw p {
  margin: 0;
}

.nvw button {
  font: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.nvw :focus-visible {
  outline: 3px solid var(--accent-text);
  outline-offset: 2px;
}

.nvw-icon {
  width: 20px;
  height: 20px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nvw-icon-small {
  width: 16px;
  height: 16px;
}

.nvw-small {
  font-size: 13px;
}

/* ---------------------------------------------------------------- Launcher */

/*
  The one thing on the host page: the primary action, so it takes the accent,
  in the shape of the mark's speech bubble, its tight corner pointing at the
  corner of the screen it lives in.
*/
.nvw-launcher {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 20px 0 16px;
  border: 0;
  border-radius: 16px 16px 4px 16px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 15px;
  font-weight: 500;
  line-height: 1;
  box-shadow: var(--float);
}

.nvw-launcher:hover {
  background: var(--accent-strong);
}

.nvw-launcher:active:not(:disabled) {
  transform: scale(0.97);
}

.nvw-launcher:focus-visible {
  outline-offset: 3px;
}

.nvw-launcher[aria-busy="true"] {
  cursor: progress;
}

.nvw-launcher[aria-busy="true"] .nvw-icon {
  animation: nvw-sheen 1.6s ease-in-out infinite;
}

/* What the Launcher has to say about itself: a cold start, or why the last
   press did not open anything. Floats above it, on its own sheet. */
.nvw-note {
  order: -1;
  max-width: min(18rem, calc(100vw - 2rem));
  padding: 10px 12px;
  border: 1px solid var(--edge);
  border-radius: 12px;
  background: var(--sheet);
  font-size: 14px;
  box-shadow: var(--float);
}

/* ------------------------------------------------------------------- Panel */

.nvw-panel {
  width: min(26rem, calc(100vw - 2rem));
  /* Dynamic viewport height rather than plain vh: a phone browser's address bar
     counts towards vh and is not part of the screen, so a panel sized that way
     puts its composer underneath the bar, exactly where somebody is typing. */
  max-height: min(42rem, calc(100dvh - 2rem));
  display: flex;
  flex-direction: column;
  background: var(--sheet);
  border: 1px solid var(--edge);
  border-radius: 16px;
  box-shadow: var(--float);
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
  height: min(42rem, calc(100dvh - 2rem));
}

.nvw-panel:focus-visible {
  outline-offset: -3px;
}

/* The panel's chrome takes the frame tint, one step off the sheet it holds. */
.nvw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 52px;
  padding: 0 8px 0 14px;
  background: var(--frame);
  border-bottom: 1px solid var(--edge);
  flex: none;
}

.nvw-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.2;
  color: var(--ink);
}

.nvw-mark {
  width: 24px;
  height: 24px;
  flex: none;
}

.nvw-mark-field {
  fill: var(--accent);
}

.nvw-mark-bubble {
  fill: none;
  stroke: var(--accent-ink);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nvw-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
}

.nvw-close:hover {
  background: var(--sheet-step);
  color: var(--ink);
}

.nvw-back {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 36px;
  padding: 0 12px 0 8px;
  border: 0;
  border-bottom: 1px solid var(--edge);
  background: var(--frame);
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  flex: none;
}

.nvw-back:hover {
  color: var(--ink);
}

.nvw-back:focus-visible {
  outline-offset: -3px;
}

.nvw-body {
  /* The panel is a fixed height and this is the part that gives — so the
     composer stays put at the bottom while the conversation scrolls above it,
     which is what makes this read as a chat rather than as a long page. */
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
  scrollbar-color: var(--raised) transparent;
}

.nvw-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
}

.nvw-quiet {
  color: var(--muted);
}

.nvw-refusal {
  color: var(--ink);
}

.nvw-problem {
  color: var(--danger);
  font-size: 14px;
}

/* A problem standing on its own in the panel: its wash, so it is seen. */
.nvw-stack > .nvw-problem,
.nvw-body > .nvw-problem,
.nvw-thread > .nvw-problem {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--danger-wash);
}

/* ------------------------------------------------------- Starting, the list */

.nvw-start {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1 1 auto;
}

.nvw-greeting {
  font-size: 22px;
  font-weight: 300;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.nvw-endings {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.nvw-list {
  list-style: none;
  margin: 0 -4px;
  padding: 0;
}

.nvw-list > li + li {
  border-top: 1px solid var(--edge);
}

.nvw-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  text-align: left;
}

.nvw-row:hover {
  background: var(--sheet-step);
}

.nvw-row > .nvw-icon {
  color: var(--muted);
}

.nvw-row-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
  min-width: 0;
}

.nvw-row-subject {
  font-weight: 500;
  overflow-wrap: anywhere;
}

.nvw-row-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  color: var(--muted);
  font-size: 13px;
}

.nvw-more,
.nvw-secondary,
.nvw-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}

.nvw-more {
  align-self: flex-start;
  border: 1px solid var(--edge);
  background: var(--sheet);
  color: var(--ink);
}

.nvw-more:hover {
  background: var(--sheet-step);
  border-color: var(--control-edge);
}

/* The list's own action. Ink, not orange: on this screen the accent belongs to
   nothing, and the Send it leads to is where the orange is. */
.nvw-secondary {
  align-self: flex-start;
  border: 0;
  background: var(--ink);
  color: var(--sheet);
}

.nvw-secondary:hover {
  opacity: 0.88;
}

/* Where a conversation stands, as a pill in its own hue: answered green once
   resolved, the amber of waiting while pending, grey where nothing is asked of
   anybody. */
.nvw-standing {
  display: flex;
}

.nvw-chip {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 9999px;
  background: var(--sheet-step);
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

.nvw-chip[data-state="open"] {
  color: var(--ink);
}

.nvw-chip[data-state="pending"] {
  background: var(--ask-wash);
  color: var(--ask);
}

.nvw-chip[data-state="resolved"] {
  background: var(--go-wash);
  color: var(--go);
}

/* ------------------------------------------------------------- The thread */

.nvw-thread {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scrollbar-color: var(--raised) transparent;
}

.nvw-said {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.nvw-said:empty {
  display: none;
}

.nvw-said-mine,
.nvw-said-theirs,
.nvw-turn {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nvw-said-mine {
  align-items: flex-end;
}

.nvw-said-theirs,
.nvw-turn {
  align-items: flex-start;
}

.nvw-mine,
.nvw-theirs {
  max-width: 86%;
  padding: 9px 13px 10px;
  border-radius: 14px;
}

/* Who said it, told twice: the name is written out for a reader who cannot see
   the alignment, and the alignment is there for a reader who is not going to
   read four names to follow a conversation. The Visitor's own words are the
   ink bubble on the right, as on the product page. */
.nvw-mine {
  background: var(--ink);
  color: var(--sheet);
  border-bottom-right-radius: 4px;
}

.nvw-theirs {
  background: var(--sheet-step);
  color: var(--ink);
  border-bottom-left-radius: 4px;
}

/* A person from the Tenant's team: the sheet itself, edged, so a reply from a
   person never passes for one from Automation. */
.nvw-theirs[data-author="user"] {
  background: var(--sheet);
  box-shadow: inset 0 0 0 1px var(--control-edge);
}

.nvw-who {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  margin-bottom: 2px;
}

.nvw-turn > .nvw-who {
  color: var(--muted);
  margin: 0 0 -2px;
}

.nvw-who time {
  font-weight: 400;
  opacity: 0.75;
  margin-left: 4px;
}

.nvw-body-text {
  /* Verbatim, so somebody's line breaks survive and their long word does not
     push the panel wider than the phone it is on. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* An Answer streaming in ahead of the Message it will shortly become, or the
   one clarifying question framed the same way. Dimmed, so it never reads as a
   second, competing copy once the real one lands beside it. */
.nvw-turn-streaming {
  opacity: 0.72;
}

.nvw-turn-status {
  font-size: 14px;
}

/*
  The ruling, at the size of a turn: Answer, Ask, Hand over, one lit.
  Unlit parts are muted words on the track; the lit one takes its outcome's hue,
  and Hand over takes the accent, because it is the one that asks a person to act.
*/
.nvw-ruling {
  display: inline-grid;
  grid-template-columns: repeat(3, auto);
  gap: 2px;
  padding: 2px;
  border-radius: 8px;
  background: var(--sheet-step);
}

.nvw-ruling > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 6px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

/* Under a reply on the step, the track takes the sheet's edge instead, so the
   strip does not run into the bubble above it. */
.nvw-said-theirs > .nvw-call .nvw-ruling,
.nvw-turn > .nvw-call .nvw-ruling {
  background: var(--sheet);
  box-shadow: inset 0 0 0 1px var(--edge);
}

.nvw-ruling [data-lit="answer"] {
  background: var(--go);
  color: var(--sheet);
}

.nvw-ruling [data-lit="clarify"] {
  background: var(--ask);
  color: var(--sheet);
}

.nvw-ruling [data-lit="escalate"] {
  background: var(--accent);
  color: var(--accent-ink);
}

/* Still deciding: nothing lit, the three parts breathing in turn. */
.nvw-ruling[data-reading] > span {
  animation: nvw-sheen 1.6s ease-in-out infinite;
}

.nvw-ruling[data-reading] > span:nth-child(2) {
  animation-delay: 0.2s;
}

.nvw-ruling[data-reading] > span:nth-child(3) {
  animation-delay: 0.4s;
}

/* Out of reach: the Turn failed, so no ruling could have been made. */
.nvw-ruling[data-off] {
  opacity: 0.45;
}

.nvw-ruling[data-off] > span {
  text-decoration: line-through;
}

/* The legend on the opening screen: each part's hue as a swatch beside its
   word, none lit, because nothing has been asked yet. */
.nvw-ruling[data-legend] > span::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.nvw-ruling [data-hue="answer"]::before {
  background: var(--go);
}

.nvw-ruling [data-hue="clarify"]::before {
  background: var(--ask);
}

.nvw-ruling [data-hue="escalate"]::before {
  background: var(--accent);
}

/*
  The hand-over: the conversation passing to a person. An Escalation writes only
  an internal Note, so this is the only notice a Visitor ever gets for it, and
  it is drawn as the product draws a hand-over: a field of the accent with the
  mark's tail cut into its top-left corner, pointing up at the strip and the
  question above it. Never a bubble, since nobody said this.
*/
.nvw-system-notice {
  --tail: 40px;
  --tail-rise: 24px;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 2px;
  padding: calc(var(--tail-rise) + 10px) 16px 14px;
  background: var(--accent);
  color: var(--accent-ink);
  border-radius: 0 0 14px 14px;
  clip-path: polygon(0 0, var(--tail) var(--tail-rise), 100% var(--tail-rise), 100% 100%, 0 100%);
}

.nvw-handover-head {
  font-size: 17px;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

/* ------------------------------------------------------------- Composing */

/*
  The box and its button side by side at the foot of the panel, on the frame
  tint, with anything the form has to say underneath both.
*/
.nvw-compose {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 6px 8px;
  margin: 0 -16px -16px;
  padding: 12px 16px;
  background: var(--frame);
  border-top: 1px solid var(--edge);
  flex: none;
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
  grid-column: 1;
  grid-row: 1;
  display: block;
  width: 100%;
  height: 44px;
  min-height: 44px;
  max-height: 136px;
  field-sizing: content;
  padding: 11px 12px;
  border: 1px solid var(--control-edge);
  border-radius: 10px;
  background: var(--sheet);
  color: var(--ink);
  font: inherit;
  font-size: 15px;
  line-height: 1.4;
  resize: none;
}

.nvw-box:hover {
  border-color: var(--muted);
}

.nvw-box:focus-visible {
  border-color: var(--ink);
  outline-offset: 1px;
}

.nvw-send {
  grid-column: 2;
  grid-row: 1;
  min-height: 44px;
  border: 0;
  background: var(--accent);
  color: var(--accent-ink);
}

.nvw-send:hover:not(:disabled) {
  background: var(--accent-strong);
}

.nvw-send:active:not(:disabled) {
  transform: scale(0.97);
}

/* Nothing to send yet: the step and its muted word, legible rather than a
   faded orange that reads as broken. */
.nvw-send:disabled {
  background: var(--sheet-step);
  color: var(--muted);
  cursor: not-allowed;
}

.nvw-compose > .nvw-problem,
.nvw-outcome {
  grid-column: 1 / -1;
  font-size: 13px;
}

.nvw-outcome {
  color: var(--muted);
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

/* The lapsed panel's one action, which is the Launcher's: the accent. */
.nvw-stack > .nvw-send {
  align-self: flex-start;
}

@media (pointer: coarse) {
  .nvw-close {
    width: 44px;
    height: 44px;
  }

  .nvw-back,
  .nvw-more,
  .nvw-secondary {
    min-height: 44px;
  }

  /* 16px, or a phone zooms the page when the box takes focus. */
  .nvw-box {
    font-size: 16px;
  }
}

/*
  A phone. The panel takes the screen, because a card floating in the corner of
  a 375px viewport is a card with a composer too small to type in — and support
  is asked for from a phone more often than from anything else.
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

  Kept to what a press or a hover needs — a colour settling, a panel arriving,
  a ruling lighting — because this renders on somebody else's page and a Widget
  that animates more than the site around it reads as an advert rather than as
  support.
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
    opacity 160ms ease,
    transform 120ms var(--ease-out);
}

.nvw-panel {
  transform-origin: bottom right;
  animation: nvw-arrive 200ms var(--ease-out);
}

.nvw-ruling [data-lit] {
  animation: nvw-lit 420ms var(--ease-out) both;
}

.nvw-system-notice {
  animation: nvw-arrive 260ms var(--ease-out);
}

@keyframes nvw-arrive {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

@keyframes nvw-lit {
  from {
    opacity: 0.25;
  }
}

@keyframes nvw-sheen {
  50% {
    opacity: 0.4;
  }
}

/* A host page that asked for less motion gets less, and the reset is total
   rather than per-rule: whatever is added above, this turns it off. The states
   stay: a lit ruling is lit, a reading one is simply unlit. */
@media (prefers-reduced-motion: reduce) {
  .nvw,
  .nvw * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .nvw-panel,
  .nvw-system-notice {
    animation: none;
  }
}
`;

/**
 * The reset first, so the Widget's own rules are written over a clean slate.
 * The tokens last: a custom property is read where it is used, not where it is
 * declared, so their place in the sheet changes nothing, and the root rule
 * that states the Widget's own typography stays the first `.nvw` rule (`boot.test.tsx` reads it).
 */
export function widgetStyles(): string {
  return `${RESET}${WIDGET}${TOKENS}`;
}
