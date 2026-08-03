/**
 * The records a Ticket is made of, as the document types them.
 *
 * Written once and shared, for the same reason the Surfaces' own fixture files
 * say: a fixture typed as the document types it cannot describe a response the
 * API could not have sent, and a second copy of one is a test that keeps passing
 * against a shape the server stopped serving.
 *
 * Plain data and no rendering, so a unit test over a pure function can take a
 * record without pulling a React tree in behind it.
 */
import type { components } from "@/api/generated/openapi";

type TicketDto = components["schemas"]["TicketDto"];
type MessageDto = components["schemas"]["MessageDto"];
type NoteDto = components["schemas"]["NoteDto"];
type AuditEntryDto = components["schemas"]["AuditEntryDto"];

export function ticket(overrides: Partial<TicketDto> = {}): TicketDto {
  return {
    id: "tkt_1",
    subject: "The printer is on fire",
    contactId: "con_1",
    assigneeId: null,
    state: "open",
    priority: "normal",
    source: "portal",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-07-02T09:00:00.000Z",
    ...overrides,
  };
}

export function message(overrides: Partial<MessageDto> = {}): MessageDto {
  return {
    id: "msg_1",
    ticketId: "tkt_1",
    body: "It is definitely on fire.",
    authorKind: "contact",
    authorId: "con_1",
    createdAt: "2026-07-01T09:00:00.000Z",
    ...overrides,
  };
}

export function note(overrides: Partial<NoteDto> = {}): NoteDto {
  return {
    id: "not_1",
    ticketId: "tkt_1",
    body: "Third printer this month — check the maintenance contract.",
    authorKind: "user",
    authorId: "usr_1",
    createdAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

export function auditEntry(overrides: Partial<AuditEntryDto> = {}): AuditEntryDto {
  return {
    id: "aud_1",
    action: "ticket.created",
    actorKind: "contact",
    actorId: "con_1",
    targetKind: "ticket",
    targetId: "tkt_1",
    ticketId: "tkt_1",
    fromValue: null,
    toValue: null,
    metadata: null,
    correlationId: null,
    createdAt: "2026-07-01T09:00:00.000Z",
    ...overrides,
  };
}
