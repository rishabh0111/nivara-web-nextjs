/**
 * Runs a Turn against `nivara-ai` for the Conversation on screen, and holds
 * what it said so far.
 *
 * Deliberately not the source of truth for the Answer: `nivara-ai` posts the
 * real reply through the API itself (`turn/service.py`'s `_answer` and
 * `_clarify` both call `writer.post_reply`), and that arrives here over the
 * existing realtime channel `useLiveConversation` already renders. What this
 * hook tracks is *perceived* latency between the two — a status line and the
 * Answer typing in — which is why its state clears on `done` rather than
 * carrying the Answer forward as this Surface's own copy of it.
 *
 * The one outcome with no independent arrival is `escalated`/`deferred`: an
 * Escalation writes only an internal Note, which the Widget never renders, so
 * this hook's `escalated` state is the only place that notice exists at all
 * and it is not cleared automatically — see `WidgetTurnNotice`.
 *
 * Held by `Widget`, above the screen the Turn is started from, and never by
 * that screen itself. The first message of a new Conversation is sent from
 * `Start`, which navigates to `Conversation` the moment the Ticket exists —
 * so a hook living in `Start` unmounts a tick after `trigger`, and the
 * unmount below discards every event the Turn goes on to send. For an
 * answered Turn that only costs the status line, since the real Message
 * arrives over the realtime channel regardless; for an escalated one it
 * discarded the only notice the Visitor was ever going to get.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { getAiEndpoints } from "@/config/ai";

import { runTurn } from "@/api/ai-seam";
import type { WidgetSession } from "./widget-session";

export type TurnState =
  | { at: "idle" }
  | { at: "working" }
  | { at: "streaming"; text: string }
  | { at: "clarify"; question: string }
  | { at: "escalated"; message: string }
  | { at: "done" }
  | { at: "error"; message: string };

export type AiTurn = {
  /**
   * What the Turn for `conversationId` is doing — `idle` for every other
   * Conversation.
   *
   * Scoped rather than read whole, because this hook is held above the screens
   * that use it: an `escalated` notice persists until something replaces it,
   * and "a person has this now" is a claim about one Conversation that must
   * not follow the Visitor into another.
   */
  stateFor(conversationId: string): TurnState;
  /** Starts a Turn for this Conversation. Safe to call repeatedly; only the latest wins. */
  trigger(conversationId: string): void;
};

export function useAiTurn(session: WidgetSession): AiTurn {
  const [state, setState] = useState<TurnState>({ at: "idle" });
  const [answering, setAnswering] = useState<string | undefined>(undefined);

  // Which call's updates are still allowed to land. A Visitor who sends a
  // second message before the first Turn's stream finishes must not have the
  // first stream's late events overwrite what the second one is doing.
  const current = useRef(0);

  useEffect(() => {
    return () => {
      current.current += 1;
    };
  }, []);

  const trigger = useCallback(
    (conversationId: string) => {
      const ai = getAiEndpoints();
      const accessToken = session.current()?.accessToken;
      if (!ai || !accessToken) return;

      const call = ++current.current;
      const stillCurrent = () => call === current.current;

      setAnswering(conversationId);
      setState({ at: "working" });

      let streamed = "";

      void runTurn(ai.httpBaseUrl, accessToken, conversationId, {
        onStatus: () => {
          if (stillCurrent()) setState((was) => (was.at === "streaming" ? was : { at: "working" }));
        },
        onToken: (text) => {
          streamed += text;
          if (stillCurrent()) setState({ at: "streaming", text: streamed });
        },
        onClarify: (question) => {
          if (stillCurrent()) setState({ at: "clarify", question });
        },
        onEscalated: (message) => {
          if (stillCurrent()) setState({ at: "escalated", message });
        },
        onDone: () => {
          // For answered/clarified, the real Message has already been posted
          // through the API (turn/service.py posts before the stream's "done"
          // is sent) and arrives here over the realtime channel independently
          // of this hook — so "working" and "streaming" both clear, rather
          // than leaving a transient bubble sitting beside the real one that
          // just landed. "escalated" is the one state that persists: nothing
          // else is ever coming for that outcome, so clearing it here would
          // erase the only notice the Visitor gets.
          if (!stillCurrent()) return;
          setState((was) => (was.at === "escalated" || was.at === "error" ? was : { at: "done" }));
        },
        onError: (_code, message) => {
          if (stillCurrent()) setState({ at: "error", message });
        },
      });
    },
    [session],
  );

  const stateFor = useCallback(
    (conversationId: string): TurnState =>
      answering === conversationId ? state : { at: "idle" },
    [answering, state],
  );

  return { stateFor, trigger };
}
