import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import { parseThreadKey, threadKey } from "@t3tools/client-runtime/state/entities";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";

import { environmentThreadDetails } from "~/state/threads";

import { deriveSessionDetail } from "./sessionDetail";
import type { SessionDetail } from "./workspaceRows";

const NO_DETAILS: ReadonlyMap<string, SessionDetail> = new Map();

// Keyed by content (callers derive the list every render). A projection is only
// subscribed while some mounted view reads this atom, and only for the refs listed.
const sessionDetailsAtom = Atom.family((refKeys: string) =>
  Atom.make((get) => {
    const details = new Map<string, SessionDetail>();
    for (const key of refKeys === "" ? [] : refKeys.split("\n")) {
      const ref = parseThreadKey(key);
      const thread = get(environmentThreadDetails.threadAtom(ref));
      if (thread === null) continue;
      const pending = get(environmentThreadDetails.pendingRequestsAtom(ref));
      details.set(
        scopedThreadKey(ref),
        deriveSessionDetail(thread.projection, pending ?? { approvals: [], userInputs: [] }),
      );
    }
    return details as ReadonlyMap<string, SessionDetail>;
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("abode-control-room-session-details")),
);

/**
 * Task-list progress and waiting questions for the given sessions, keyed by
 * their scoped thread key. Pass only running and needs-you sessions: each ref
 * costs a live projection.
 */
export function useSessionDetails(
  refs: ReadonlyArray<ScopedThreadRef>,
): ReadonlyMap<string, SessionDetail> {
  const details = useAtomValue(sessionDetailsAtom(refs.map(threadKey).join("\n")));
  return refs.length === 0 ? NO_DETAILS : details;
}
