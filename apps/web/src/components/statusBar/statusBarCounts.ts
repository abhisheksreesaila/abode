import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/unstable/reactivity";

import { environmentThreadShells } from "../../state/threads";
import {
  countThreadActivity,
  decodeCounts,
  encodeCounts,
  type ThreadActivityCounts,
} from "./statusBar.logic";

// The atom's value is a short string, so subscribers re-render only when a
// count changes, not on every shell update during a streaming turn.
const statusBarCountsAtom = Atom.make((get) =>
  encodeCounts(countThreadActivity(get(environmentThreadShells.threadShellsAtom))),
).pipe(Atom.withLabel("web-status-bar-counts"));

export function useStatusBarCounts(): ThreadActivityCounts {
  return decodeCounts(useAtomValue(statusBarCountsAtom));
}
