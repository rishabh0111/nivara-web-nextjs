import type { TurnState } from "./use-ai-turn";
import { TurnRuling } from "./widget-ruling";

/**
 * Automation's turn, at the foot of the thread, while `nivara-ai` works and
 * after, where it has something to show that no Message will ever carry.
 *
 * Each state is drawn as the ruling it is heading for or reached: an unlit
 * strip while it reads, the Answer typing in above a strip still deciding, the
 * one question with Ask lit, and the hand-over as the conversation passing to
 * a person, with Hand over lit and the stage cut with the mark's tail.
 *
 * `"idle"` and `"done"` render nothing: the first because no Turn has run yet,
 * the second because whatever the Turn produced already arrived as a real
 * Message (see `useAiTurn`), which the thread marks itself. An escalation
 * writes no Message, so it stays here rather than clearing to nothing.
 */
export function WidgetTurnNotice({ state }: { state: TurnState }) {
  switch (state.at) {
    case "idle":
    case "done":
      return null;

    case "working":
      return (
        <div className="nvw-turn" role="status" aria-live="polite">
          <p className="nvw-who">Automation</p>
          <TurnRuling call={{ reading: true }} />
          <p className="nvw-quiet nvw-turn-status">Checking the help centre…</p>
        </div>
      );

    case "streaming":
      return (
        <div className="nvw-turn" role="status" aria-live="polite">
          <div className="nvw-theirs nvw-turn-streaming">
            <p className="nvw-who">Automation</p>
            <p className="nvw-body-text">{state.text}</p>
          </div>
          <TurnRuling call={{ reading: true }} />
        </div>
      );

    case "clarify":
      return (
        <div className="nvw-turn" role="status" aria-live="polite">
          <div className="nvw-theirs nvw-turn-streaming">
            <p className="nvw-who">Automation</p>
            <p className="nvw-body-text">{state.question}</p>
          </div>
          <TurnRuling call={{ ruling: "clarify" }} />
        </div>
      );

    case "escalated":
      return (
        <div className="nvw-turn" role="status" aria-live="polite">
          <p className="nvw-who">Automation</p>
          <TurnRuling call={{ ruling: "escalate" }} />
          {/* Nobody said this, so it is not a bubble: the conversation itself
              changing hands, on the hand-over's own stage. */}
          <div className="nvw-system-notice">
            <p className="nvw-handover-head">Handed to a person</p>
            <p className="nvw-body-text">{state.message}</p>
          </div>
        </div>
      );

    case "error":
      // Quiet rather than alarming: the Visitor's message is already sent and
      // safe (useWidgetWrites landed it before this hook was ever triggered),
      // so this is "the assistant couldn't answer", not "your message failed".
      // The strip is drawn out of reach: no ruling was made.
      return (
        <div className="nvw-turn" role="status" aria-live="polite">
          <p className="nvw-who">Automation</p>
          <TurnRuling call={{ off: true }} />
          <p className="nvw-quiet nvw-turn-status">{state.message}</p>
        </div>
      );
  }
}
