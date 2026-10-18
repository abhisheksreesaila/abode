import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { parseThreadKey, threadKey } from "@t3tools/client-runtime/state/entities";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";

import { environmentThreadDetails } from "~/state/threads";

import { deriveSessionDetail, sameSessionDetail } from "./sessionDetail";
import type { SessionDetail } from "./workspaceRows";

const NO_DETAILS: ReadonlyMap<string, SessionDetail> = new Map();
// A short grace period so a session that stays in the running set across a re-key of
// the combined atom keeps its projection subscription instead of resubscribing.
const KEEP_MS = 5_000;

// One atom per session: streamed deltas that do not change the task counts or the
// waiting question return the previous object, so nothing downstream recomputes.
const sessionDetailAtom = Atom.family((key: string) => {
  const ref = parseThreadKey(key);
  let previous: SessionDetail | null = null;
  return Atom.make((get) => {
    const thread = get(environmentThreadDetails.threadAtom(ref));
    if (thread === null) return null;
    const pending = get(environmentThreadDetails.pendingRequestsAtom(ref));
    const next = deriveSessionDetail(
      thread.projection,
      pending ?? { approvals: [], userInputs: [] },
    );
    if (previous !== null && sameSessionDetail(previous, next)) return previous;
    previous = next;
    return next;
  }).pipe(Atom.setIdleTTL(KEEP_MS), Atom.withLabel(`abode-control-room-session:${key}`));
});

// Keyed by content (callers derive the list every render).
const sessionDetailsAtom = Atom.family((refKeys: string) => {
  let previous: ReadonlyMap<string, SessionDetail> = NO_DETAILS;
  return Atom.make((get) => {
    const details = new Map<string, SessionDetail>();
    for (const key of refKeys === "" ? [] : refKeys.split("\n")) {
      const detail = get(sessionDetailAtom(key));
      if (detail !== null) details.set(scopedThreadKey(parseThreadKey(key)), detail);
    }
    const unchanged =
      details.size === previous.size &&
      [...details].every(([key, detail]) => previous.get(key) === detail);
    if (unchanged) return previous;
    previous = details;
    return details as ReadonlyMap<string, SessionDetail>;
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("abode-control-room-session-details"));
});

/**
 * Task-list progress and waiting questions for the given sessions, keyed by
 * their scoped thread key. Pass only running and needs-you sessions: each ref
 * costs a live projection.
 */
export function useSessionDetails(
  refs: ReadonlyArray<ScopedThreadRef>,
): ReadonlyMap<string, SessionDetail> {
  const details = useAtomValue(sessionDetailsAtom(refs.map(threadKey).toSorted().join("\n")));
  return refs.length === 0 ? NO_DETAILS : details;
}
