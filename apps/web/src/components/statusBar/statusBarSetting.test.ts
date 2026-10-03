import { describe, expect, it, vi } from "vite-plus/test";

import { createStatusBarSettingStore } from "./statusBarSetting";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("status bar setting store", () => {
  it("is off by default and persists under abode:status-bar:v1", () => {
    const storage = memoryStorage();
    const store = createStatusBarSettingStore(() => storage);
    expect(store.get()).toBe(false);
    store.set(true);
    expect(storage.getItem("abode:status-bar:v1")).toBe('{"enabled":true}');
    expect(store.get()).toBe(true);
    store.set(false);
    expect(store.get()).toBe(false);
  });

  it("stays off for unreadable values, missing storage, or storage that throws", () => {
    const storage = memoryStorage();
    storage.setItem("abode:status-bar:v1", "not json");
    expect(createStatusBarSettingStore(() => storage).get()).toBe(false);
    expect(createStatusBarSettingStore(() => null).get()).toBe(false);
    const throwing = createStatusBarSettingStore(() => ({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    }));
    expect(throwing.get()).toBe(false);
    expect(() => throwing.set(true)).not.toThrow();
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const store = createStatusBarSettingStore(() => memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
