import { describe, expect, it, vi } from "vite-plus/test";

import { createDelightsStore } from "./delightsSetting";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("delights setting store", () => {
  it("is on by default and persists under abode:delights:v1", () => {
    const storage = memoryStorage();
    const store = createDelightsStore(() => storage);
    expect(store.get()).toBe(true);
    store.set(false);
    expect(storage.getItem("abode:delights:v1")).toBe('{"enabled":false}');
    expect(store.get()).toBe(false);
    store.set(true);
    expect(store.get()).toBe(true);
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const store = createDelightsStore(() => memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set(false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stays on when storage is unavailable or throws", () => {
    expect(createDelightsStore(() => null).get()).toBe(true);
    const throwing = createDelightsStore(() => ({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    }));
    expect(throwing.get()).toBe(true);
    expect(() => throwing.set(false)).not.toThrow();
  });
});
