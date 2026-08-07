/**
 * The conversation a Visitor has open, kept current as staff answer it.
 *
 * One Room, where the Dashboard reads two. A Ticket's `:internal` Room is
 * refused to a customer principal by the server, so there is no second
 * subscription to make and no second cursor to hold — the Widget could not read
 * a Note if it asked.
 *
 * It does not ask, and it also does not *apply* one. Those are two separate
 * defences and both are wanted: the wire gate is the one that matters, and this
 * one is here because a Note reaching this client at all would mean the gate
 * had already failed — through a Room replayed to the wrong socket, a server
 * that mis-routed, or an event published into the customer-visible Room by
 * mistake. On this Surface, a colleague's aside rendered as a reply is the
 * worst thing this application can do, so the last line before the screen also
 * refuses it, and refuses it by event name rather than by which Room it came
 * from — the two payloads are identical, so reading the Room here would make
 * this defence the same subscription bug over again.
 */
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import { appendToThread } from "@/realtime/append-to-thread";
import { noCaseFor, rooms, type RealtimeEnvelope } from "@/realtime/envelope";
import { useLiveRoom } from "@/realtime/use-live-room";

import { widgetKeys } from "./widget-keys";
import type { WidgetSession } from "./widget-session";

export function useLiveConversation(
  session: WidgetSession,
  /** The conversation on screen, or nothing where the Visitor is not in one. */
  ticketId: string | undefined,
): void {
  const cache = useQueryClient();

  useLiveRoom(session.live, ticketId ? rooms.ticket(session.tenantId, ticketId) : undefined, {
    envelope: (envelope) => applyToConversation(envelope, cache),

    /**
     * The Gap: what is held for this conversation can no longer be accounted
     * for, so it goes and is read again. The key is the conversation's prefix,
     * which takes the Ticket and its thread together — they were filled from
     * the same Room and are stale for the same reason.
     *
     * Nothing is said to the Visitor. A bounded replay buffer moving on is not
     * something a person on a Tenant's website has any use for hearing about;
     * what they see is the moment of loading they would see anyway.
     */
    gap: () => {
      if (ticketId) void cache.resetQueries({ queryKey: widgetKeys.conversation(ticketId) });
    },
  });
}

function applyToConversation(envelope: RealtimeEnvelope, cache: QueryClient): void {
  switch (envelope.event) {
    case "message.created":
      // First, not last. The thread is read newest-first and reversed whole for
      // rendering, so the newest row belongs at the start of the pages held.
      appendToThread(cache, widgetKeys.thread(envelope.data.ticketId), envelope.data, "first");
      // A reply moves the Ticket it lands on, so the conversation's standing
      // and its place in the list are both a moment out of date. Asked rather
      // than derived, for the reason `changed` below gives.
      changed(cache, envelope.data.ticketId);
      return;

    // Never applied, on any Surface, from any Room. See the note at the top.
    case "note.created":
      return;

    case "ticket.created":
    case "ticket.updated":
    case "ticket.assigned":
      changed(cache, envelope.data.id);
      return;

    // Staff furniture, and it is only here because the type says it can arrive.
    // A Visitor has no use for a timer their Tenant configured, and a delivery
    // to an integration they have never heard of is not their failure to see.
    case "ticket.sla.breached":
    case "ticket.integration.failed":
      return;

    default:
      return noCaseFor(envelope);
  }
}

/**
 * A conversation that moved. The API is asked what it now says.
 *
 * The envelope carries a full Ticket snapshot and filing it would be one line.
 * Authority is what the API last answered, never what arrived on the socket:
 * `seq` orders a Room and nothing orders a Room against an HTTP reply, so a
 * snapshot applied on arrival can put an older state on the screen and leave it
 * there. Re-asking cannot, whatever order things turn up in.
 */
function changed(cache: QueryClient, ticketId: string): void {
  // Exact, because this key is a prefix of the thread's — and the thread is
  // maintained by appending what the socket carried, not by re-reading a
  // cursor-paginated conversation to learn one line.
  void cache.invalidateQueries({ queryKey: widgetKeys.conversation(ticketId), exact: true });

  /*
    The list of conversations, and this is deliberately *not* the Overtaken
    treatment ADR-0002 asks of the Dashboard's queue. That rule exists because a
    Slice rearranging under a reader's cursor is a way to click the wrong
    Ticket; it protects a reader who is looking at a list. Nobody here is. The
    Widget joins a Room only while a conversation is open, so the only envelope
    that can reach this line arrives while the list is off screen and its query
    inactive — invalidating marks it stale and re-reads it when the Visitor
    comes back, which is the moment they would want it read. There is also no
    Slice to be overtaken: this list has no filters, no order to choose, and one
    button per row.
  */
  void cache.invalidateQueries({ queryKey: widgetKeys.tickets, exact: true });
}
