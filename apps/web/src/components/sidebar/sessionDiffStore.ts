import { create } from "zustand";

import type { DiffStat } from "./sessionsSections";

interface SessionDiffState {
  readonly byThreadKey: Readonly<Record<string, DiffStat | null>>;
  readonly set: (threadKey: string, stat: DiffStat | null) => void;
  /** Forget a thread once its detail is no longer watched, so its row cannot go stale. */
  readonly clear: (threadKey: string) => void;
}

/**
 * Diff totals (+N −M) for the threads whose detail the sidebar already holds.
 * The prewarmer writes it; session rows only read it, so a row never opens a
 * thread stream of its own. Threads with no loaded detail show no diff.
 */
export const useSessionDiffStore = create<SessionDiffState>((set) => ({
  byThreadKey: {},
  set: (threadKey, stat) =>
    set((state) => {
      const current = state.byThreadKey[threadKey];
      if (
        current === stat ||
        (current &&
          stat &&
          current.additions === stat.additions &&
          current.deletions === stat.deletions)
      ) {
        return state;
      }
      return { byThreadKey: { ...state.byThreadKey, [threadKey]: stat } };
    }),
  clear: (threadKey) =>
    set((state) => {
      if (!(threadKey in state.byThreadKey)) return state;
      const { [threadKey]: _removed, ...rest } = state.byThreadKey;
      return { byThreadKey: rest };
    }),
}));
