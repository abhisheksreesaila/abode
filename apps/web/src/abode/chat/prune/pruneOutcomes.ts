import { useSyncExternalStore } from "react";

/**
 * What a prune card did, kept outside the card so scrolling it away and back (the chat unmounts
 * rows) still shows "Moved N to trash" with its Restore button. Keyed by the block's text.
 */
export interface PruneOutcome {
  readonly moved: ReadonlyArray<string>;
  readonly note: string | null;
}

const outcomes = new Map<string, PruneOutcome>();
const listeners = new Set<() => void>();

export function setPruneOutcome(key: string, outcome: PruneOutcome | null): void {
  if (outcome === null || outcome.moved.length === 0) outcomes.delete(key);
  else outcomes.set(key, outcome);
  for (const listener of listeners) listener();
}

export function usePruneOutcome(key: string): PruneOutcome | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => outcomes.get(key) ?? null,
    () => null,
  );
}
