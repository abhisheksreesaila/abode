import { useRouter, type RouterHistory } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

type HistoryAction = "PUSH" | "REPLACE" | "FORWARD" | "BACK" | "GO";

/**
 * The furthest in-app history index seen. The browser cannot say whether a
 * forward entry exists, so we track it: a push drops everything ahead of it,
 * back/forward/go can only reveal entries up to the tip, and a replace leaves
 * the entries ahead alone.
 */
export function advanceHistoryTip(tip: number, action: HistoryAction, index: number): number {
  if (action === "PUSH") return index;
  return Math.max(tip, index);
}

export function canGoForwardAt(tip: number, index: number): boolean {
  return index < tip;
}

const indexOf = (history: RouterHistory): number => history.location.state.__TSR_index ?? 0;

function createHistoryTipStore(history: RouterHistory) {
  let tip = indexOf(history);
  let snapshot = canGoForwardAt(tip, indexOf(history));
  const listeners = new Set<() => void>();
  // Lives for the app's lifetime, like the router itself.
  history.subscribe(({ location, action }) => {
    const index = location.state.__TSR_index ?? 0;
    tip = advanceHistoryTip(tip, action.type, index);
    const next = canGoForwardAt(tip, index);
    if (next === snapshot) return;
    snapshot = next;
    for (const listener of listeners) listener();
  });
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const storesByHistory = new WeakMap<RouterHistory, ReturnType<typeof createHistoryTipStore>>();

/** True when there is a forward entry inside the app's own history. */
export function useCanGoForward(): boolean {
  const { history } = useRouter();
  let store = storesByHistory.get(history);
  if (!store) {
    store = createHistoryTipStore(history);
    storesByHistory.set(history, store);
  }
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => false);
}
