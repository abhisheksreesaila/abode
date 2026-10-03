/**
 * The client-side "Show status bar" switch (Settings -> Appearance, abode
 * F-038). It lives in localStorage under `abode:status-bar:v1`, per browser,
 * and defaults off: the bar is only mounted (and --status-bar-height only
 * reserved) when it is on.
 */

import { useSyncExternalStore } from "react";

export const STATUS_BAR_STORAGE_KEY = "abode:status-bar:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Default off: only an explicit `{"enabled":true}` shows the bar. */
export function parseStatusBarEnabled(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && "enabled" in value) {
      return value.enabled === true;
    }
  } catch {
    // Unreadable value: fall through to the default.
  }
  return false;
}

export function createStatusBarSettingStore(getStorage: () => StorageLike | null) {
  const listeners = new Set<() => void>();
  const read = (): boolean => {
    try {
      return parseStatusBarEnabled(getStorage()?.getItem(STATUS_BAR_STORAGE_KEY) ?? null);
    } catch {
      return false;
    }
  };
  return {
    get: read,
    set(enabled: boolean): void {
      try {
        getStorage()?.setItem(STATUS_BAR_STORAGE_KEY, JSON.stringify({ enabled }));
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

const store = createStatusBarSettingStore(() =>
  typeof window === "undefined" ? null : window.localStorage,
);

export function setStatusBarEnabled(enabled: boolean): void {
  store.set(enabled);
}

export function useStatusBarEnabled(): boolean {
  return useSyncExternalStore(store.subscribe, store.get, () => false);
}
