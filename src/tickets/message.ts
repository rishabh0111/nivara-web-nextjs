/**
 * A Message on a Ticket's thread.
 *
 * `authorKind` is server-stamped from the writing credential rather than
 * claimed by the request, which is what makes it trustworthy enough to label a
 * message by.
 */
import type { components } from "@/api/generated/openapi";

export type Message = components["schemas"]["MessageDto"];
export type ActorKind = components["schemas"]["ActorKind"];
