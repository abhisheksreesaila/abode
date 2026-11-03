import { describe, expect, it, vi } from "vite-plus/test";

import { deriveFeed } from "./feedModel";

describe("last-seen store hydration", () => {
  it("reads a value saved before the snapshot existed as an empty snapshot with no ms items", async () => {
    const saved = new Map([
      ["abode:overview:v1", JSON.stringify({ state: { lastSeenAt: 1234 }, version: 1 })],
    ]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => void saved.set(key, value),
        removeItem: (key: string) => void saved.delete(key),
      },
    });
    vi.resetModules();
    const { useLastSeenStore } = await import("./overviewState");
    await useLastSeenStore.persist.rehydrate();
    const { lastSeenAt, doneSnapshot } = useLastSeenStore.getState();
    expect(lastSeenAt).toBe(1234);
    expect(doneSnapshot).toEqual({});
    const feed = deriveFeed(
      {
        sessions: [],
        milestones: [{ workspaceKey: "w", workspaceName: "w", done: [{ key: "m1", name: "One" }] }],
        snapshot: doneSnapshot,
        now: 5000,
      },
      lastSeenAt,
    );
    expect(feed).toEqual([]);
    vi.unstubAllGlobals();
  });
});
