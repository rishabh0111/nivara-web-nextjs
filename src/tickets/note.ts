/**
 * An internal Note on a Ticket.
 *
 * A separate table behind a separate endpoint, not a flag on a Message: the
 * customer-visible read does not look here, so a Note cannot be delivered to a
 * Contact by any parameter to any call. That is worth saying in the type layer
 * too — `Note` and `Message` are different types precisely so that a component
 * rendering one cannot be handed the other.
 */
import type { components } from "@/api/generated/openapi";

export type Note = components["schemas"]["NoteDto"];
