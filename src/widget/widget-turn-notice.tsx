import type { TurnState } from "./use-ai-turn";

/**
 * What sits below the thread while `nivara-ai` works, and after, where it has
 * something to say that no Message will ever carry.
 *
 * `"idle"` and `"done"` render nothing — the first because no Turn has run
 * yet, the second because whatever the Turn produced either already arrived
 * as a real Message (see `useAiTurn`) or was an escalation, which renders its
 * own persistent notice below rather than clearing to nothing.
 */
export function WidgetTurnNotice({ state }: { state: TurnState }) {
  switch (state.at) {
    case "idle":
    case "done":
      return null;

    case "working":
      return (
        <p className="nvw-quiet nvw-turn-status" role="status" aria-live="polite">
          …
        </p>
      );

    case "streaming":
      return (
        <p className="nvw-theirs nvw-body-text nvw-turn-streaming" role="status" aria-live="polite">
          {state.text}
        </p>
      );

    case "clarify":
      return (
        <p className="nvw-theirs nvw-body-text nvw-turn-streaming" role="status" aria-live="polite">
          {state.question}
        </p>
      );

    case "escalated":
      return (
        <p className="nvw-system-notice" role="status" aria-live="polite">
          {state.message}
        </p>
      );

    case "error":
      // Quiet rather than alarming: the Visitor's message is already sent and
      // safe (useWidgetWrites landed it before this hook was ever triggered),
      // so this is "the assistant couldn't answer", not "your message failed".
      return (
        <p className="nvw-quiet nvw-turn-status" role="status" aria-live="polite">
          {state.message}
        </p>
      );
  }
}
