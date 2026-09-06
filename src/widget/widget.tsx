// No `"use client"`: nothing in the Widget is ever rendered by Next. It runs on
// a Tenant's page, from a bundle Next does not build.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useColdStartPhase } from "@/cold-start/use-cold-start";

import { useAiTurn } from "./use-ai-turn";
import { useLiveConversation } from "./use-live-conversation";
import { useWidgetApi } from "./use-widget-tickets";
import { Conversation } from "./widget-conversation";
import { Conversations, Start } from "./widget-conversations";
import type { ResumedWidget } from "./widget-memory";
import { readWidgetFailure, type WidgetSession } from "./widget-session";

/**
 * What the Visitor sees, and the only thing on their page until they ask for
 * it: a Launcher.
 *
 * The session is minted when the Launcher is pressed, not when the Snippet
 * loads. A Tenant's page should cost a visitor who never asks for support one
 * script and nothing else — no credential minted for somebody reading a
 * shipping policy, and no session on the API for a page view.
 */

type Phase =
  /** The Launcher, and whatever the last press had to say about itself. */
  | { at: "launcher"; trouble?: string }
  | { at: "opening" }
  | { at: "open" }
  /**
   * The session went while the Visitor had the Widget open on it.
   *
   * Said plainly rather than absorbed. A Widget session is renewed ahead of
   * expiry precisely so this does not happen, but a laptop that slept through
   * the renewal or a session revoked at the API both land here — and what must
   * never happen is a panel that goes on looking exactly like a working one
   * while every send is refused.
   */
  | { at: "lapsed" }
  /**
   * The gate refused this page. Terminal, and the only terminal phase: the
   * answer is settled for as long as the Widget is on this origin, so the
   * Launcher goes rather than inviting a press that cannot succeed.
   */
  | { at: "refused"; words: string };

/**
 * Where the Visitor is inside the panel.
 *
 * Only `reading` is remembered across a page load. A half-typed opening is not
 * carried anywhere — the text would be gone regardless, and returning somebody
 * to an empty box they have to recognise is worse than returning them to their
 * conversations.
 */
type Where = { at: "conversations" } | { at: "starting" } | { at: "reading"; ticketId: string };

export function Widget({ session, resumed }: { session: WidgetSession; resumed: ResumedWidget }) {
  // Both read once, from what the last page left. A Visitor who navigated with
  // the Widget open and a conversation on screen lands here with the same thing
  // on screen, which is the whole of "it survives navigation".
  const [phase, setPhase] = useState<Phase>(() =>
    session.current() && resumed.place.open ? { at: "open" } : { at: "launcher" },
  );
  const [where, setWhere] = useState<Where>(() =>
    resumed.place.ticketId
      ? { at: "reading", ticketId: resumed.place.ticketId }
      : { at: "conversations" },
  );

  const coldStart = useColdStartPhase();
  const api = useWidgetApi(session);
  const cache = useQueryClient();

  // Held here rather than on the screen that starts it. `Start` navigates to
  // `Conversation` the moment the Ticket exists, so a Turn triggered from
  // there would be abandoned a tick later — including the escalation notice,
  // which nothing else in the Widget ever delivers. See `useAiTurn`.
  const aiTurn = useAiTurn(session);

  // Read as it changes, because the session can end without anybody here
  // pressing anything: a renewal refused ahead of expiry clears the credential
  // and this is how the panel comes to know.
  const credential = useSyncExternalStore(
    useCallback((changed: () => void) => session.subscribe(changed), [session]),
    useCallback(() => session.current(), [session]),
    useCallback(() => session.current(), [session]),
  );

  // The conversation being read, kept current as staff answer it. Called
  // unconditionally with the Room or with nothing, so joining and leaving
  // follow where the Visitor is rather than a component mounting.
  useLiveConversation(session, where.at === "reading" ? where.ticketId : undefined);

  useEffect(() => {
    if (credential) return;

    // Only from `open`. Every other phase is one where no session was held in
    // the first place — a Launcher waiting to be pressed, or a mint in flight —
    // and calling those lapsed would report an ending to somebody who had not
    // started.
    setPhase((standing) => (standing.at === "open" ? { at: "lapsed" } : standing));
  }, [credential]);

  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  /**
   * A move the Visitor made, waiting for the thing they moved to to exist.
   *
   * Focus cannot be handed over where it is handed over from: the control being
   * left is the one being replaced, and the one to focus has not rendered yet.
   * So the move is recorded and the focus follows in an effect.
   *
   * Recorded rather than derived, because only a move the Visitor made earns
   * the focus. A Widget that focused itself whenever it happened to be open
   * would take a stranger's visitor out of a stranger's page on every single
   * navigation, for a conversation they did not ask to return to.
   */
  const moved = useRef<"opened" | "closed" | undefined>(undefined);

  useEffect(() => {
    resumed.moved({
      open: phase.at === "open",
      ticketId: where.at === "reading" ? where.ticketId : undefined,
    });
  }, [resumed, phase.at, where]);

  useEffect(() => {
    if (phase.at === "open" && moved.current === "opened") {
      moved.current = undefined;
      panel.current?.focus();
    }

    // Back where they were standing. Closing a panel and being dropped at the
    // top of somebody else's page is the keyboard equivalent of losing your
    // place on it.
    if (phase.at === "launcher" && moved.current === "closed") {
      moved.current = undefined;
      launcher.current?.focus();
    }
  }, [phase.at]);

  async function open() {
    moved.current = "opened";

    if (session.current()) {
      setPhase({ at: "open" });
      return;
    }

    /*
      Minting is always a *new* anonymous Visitor, so anything held from before
      belongs to somebody this session cannot be. It is dropped here rather than
      at the one place a lapse is announced, because that is not the only way to
      arrive at a mint: a session can lapse with the panel closed, or be closed
      out of the lapse notice, and both come back through this Launcher. On a
      Visitor's first press there is nothing held and this costs nothing, which
      is what makes one rule better than three places that must agree.
    */
    cache.clear();
    setWhere({ at: "conversations" });

    setPhase({ at: "opening" });
    const result = await session.start();

    if (result.ok) {
      setPhase({ at: "open" });
      return;
    }

    const failure = readWidgetFailure(result.failure);

    // Weather goes back to the Launcher carrying what happened, so the Visitor
    // can press it again. Only the gate takes the Launcher away.
    setPhase(
      failure.gate
        ? { at: "refused", words: failure.words }
        : { at: "launcher", trouble: failure.words },
    );
  }

  function close() {
    moved.current = "closed";
    setPhase({ at: "launcher" });
  }

  if (phase.at === "open") {
    return (
      <section
        ref={panel}
        tabIndex={-1}
        role="dialog"
        // Not modal. It is a panel on somebody else's page, and the page
        // underneath stays theirs to use — claiming otherwise would tell a
        // screen reader the rest of the site had gone away.
        aria-modal={false}
        aria-label="Support"
        className="nvw-panel nvw-panel-live"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          // Stopped here, so a host page listening for Escape does not also act
          // on the one that closed this.
          event.stopPropagation();
          close();
        }}
      >
        <div className="nvw-header">
          {/* Kept whatever is on screen. The heading is the panel's structure
              for anyone navigating by headings, and swapping it for a back
              control would take that away exactly where it is most useful. */}
          <h2 className="nvw-title">Support</h2>

          <button type="button" className="nvw-close" onClick={close}>
            Close
          </button>
        </div>

        {where.at === "conversations" ? null : (
          <button
            type="button"
            className="nvw-back"
            onClick={() => setWhere({ at: "conversations" })}
          >
            Your conversations
          </button>
        )}

        <div className="nvw-body">
          {where.at === "reading" ? (
            <Conversation
              api={api}
              aiTurn={aiTurn}
              ticketId={where.ticketId}
              // Where a message landed is the API's answer, and this follows it.
              onFollow={(ticketId) => setWhere({ at: "reading", ticketId })}
            />
          ) : where.at === "starting" ? (
            <Start
              api={api}
              aiTurn={aiTurn}
              onStarted={(ticketId) => setWhere({ at: "reading", ticketId })}
            />
          ) : (
            <Conversations
              api={api}
              aiTurn={aiTurn}
              onRead={(ticketId) => setWhere({ at: "reading", ticketId })}
              onStart={() => setWhere({ at: "starting" })}
            />
          )}
        </div>
      </section>
    );
  }

  if (phase.at === "lapsed") {
    return (
      <section className="nvw-panel" aria-label="Support">
        <div className="nvw-header">
          <h2 className="nvw-title">Support</h2>

          <button type="button" className="nvw-close" onClick={close}>
            Close
          </button>
        </div>

        <div className="nvw-body">
          <div className="nvw-stack">
            {/*
              What it says is what is true, including the part a Visitor would
              otherwise discover by being surprised: starting again is a new
              conversation, because the session that owned the last one is the
              only thing that could reach it.
            */}
            <p className="nvw-problem" role="alert">
              Your support session has ended. You can start a new conversation — the earlier one
              will not be here.
            </p>

            {/* The same door as the Launcher, and deliberately: what it does
                is mint a session, which is what starting again is. */}
            <button type="button" className="nvw-send" onClick={() => void open()}>
              Start again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (phase.at === "refused") {
    return (
      <section className="nvw-panel" aria-label="Support">
        <div className="nvw-header">
          <h2 className="nvw-title">Support</h2>
        </div>
        <div className="nvw-body">
          <p className="nvw-refusal" role="alert">
            {phase.words}
          </p>
        </div>
      </section>
    );
  }

  const opening = phase.at === "opening";

  return (
    <>
      <button
        type="button"
        ref={launcher}
        className="nvw-launcher"
        aria-haspopup="dialog"
        aria-expanded={false}
        aria-busy={opening}
        disabled={opening}
        onClick={() => void open()}
      >
        {opening ? "Connecting…" : "Chat with support"}
      </button>

      {opening && coldStart !== "idle" ? (
        // Named rather than spun on, exactly as on every other Surface. The API
        // sleeps when idle and the first request after that takes tens of
        // seconds; a Launcher that only said "Connecting…" would read as broken.
        <p className="nvw-quiet" role="status" aria-live="polite">
          {coldStart === "acknowledged"
            ? "Still connecting…"
            : "Support is waking up. This can take up to a minute."}
        </p>
      ) : null}

      {phase.at === "launcher" && phase.trouble ? (
        <p className="nvw-refusal" role="alert">
          {phase.trouble}
        </p>
      ) : null}
    </>
  );
}
