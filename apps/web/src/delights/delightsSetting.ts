/**
 * The client-side "Little delights" switch (Settings -> Appearance). It lives
 * in localStorage under `abode:delights:v1`, per browser, and defaults on.
 */

import { useSyncExternalStore } from "react";

import { DELIGHTS_STORAGE_KEY, parseDelightsEnabled } from "./delights.logic";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function createDelightsStore(getStorage: () => StorageLike | null) {
  const listeners = new Set<() => void>();
  const read = (): boolean => {
    try {
      return parseDelightsEnabled(getStorage()?.getItem(DELIGHTS_STORAGE_KEY) ?? null);
    } catch {
      return true;
    }
  };
  return {
    get: read,
    set(enabled: boolean): void {
      try {
        getStorage()?.setItem(DELIGHTS_STORAGE_KEY, JSON.stringify({ enabled }));
      } catch {
        // Storage unavailable: the switch simply does not persist.
      }
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const store = createDelightsStore(() =>
  typeof window === "undefined" ? null : window.localStorage,
);

export function setDelightsEnabled(enabled: boolean): void {
  store.set(enabled);
}

export function useDelightsEnabled(): boolean {
  return useSyncExternalStore(store.subscribe, store.get, () => true);
}
