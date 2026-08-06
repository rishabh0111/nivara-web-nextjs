"use client";

/**
 * A view reads a Room for as long as it is on the screen.
 *
 * Joining and leaving are the mount and the unmount, and the reference counting
 * underneath means two views on one Room cost one subscription. What a view
 * does with an envelope is its own business; this hook only makes sure the
 * Room is being read, and stops when nobody is reading it.
 */
import { useEffect, useRef } from "react";

import type { RoomReader } from "./connection";
import type { LiveConnection } from "./live-connection";

export function useLiveRoom(
  live: LiveConnection,
  /**
   * The Room, or nothing yet.
   *
   * A Room's name carries the tenant, and the tenant is read from the API along
   * with everything else about the principal — so for the first moments of a
   * screen there is no Room to name. Undefined is that moment, and it reads
   * nothing rather than joining a Room assembled from a tenant nobody has
   * confirmed.
   */
  room: string | undefined,
  /**
   * What this view does with what arrives, and what it drops when the server
   * says it can no longer answer for this Room. Both are required, because a
   * view that had no answer to the second would be one that keeps showing state
   * nothing stands behind.
   */
  reader: RoomReader,
): void {
  // Held in a ref so that a reader written inline — which every caller will
  // write — does not leave and rejoin the Room on every render.
  const held = useRef(reader);
  held.current = reader;

  useEffect(() => {
    if (room === undefined) return;

    return live.join(room, {
      envelope: (envelope) => held.current.envelope(envelope),
      gap: () => held.current.gap(),
    });
  }, [live, room]);
}
