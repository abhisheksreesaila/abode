import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useStatusBarStore } from "./statusBarStore";

const info = (threadKey: string, contextPercent: number | null = 10) => ({
  threadKey,
  modelLabel: "Opus",
  contextPercent,
});

describe("statusBarStore", () => {
  beforeEach(() => {
    useStatusBarStore.setState({ info: null, active: null });
  });

  it("keeps the same state object when an identical snapshot is published", () => {
    useStatusBarStore.getState().publish(info("t1"));
    const before = useStatusBarStore.getState();
    useStatusBarStore.getState().publish(info("t1"));
    expect(useStatusBarStore.getState()).toBe(before);
  });

  it("replaces the snapshot when a value or the thread changes", () => {
    useStatusBarStore.getState().publish(info("t1", 10));
    useStatusBarStore.getState().publish(info("t1", 20));
    expect(useStatusBarStore.getState().info?.contextPercent).toBe(20);
    useStatusBarStore.getState().publish(info("t2", 20));
    expect(useStatusBarStore.getState().info?.threadKey).toBe("t2");
  });

  it("ignores a clear from a thread that is no longer the published one", () => {
    useStatusBarStore.getState().publish(info("t1"));
    useStatusBarStore.getState().publish(info("t2"));
    useStatusBarStore.getState().clear("t1");
    expect(useStatusBarStore.getState().info?.threadKey).toBe("t2");
    useStatusBarStore.getState().clear("t2");
    expect(useStatusBarStore.getState().info).toBeNull();
  });

  it("guards the active thread the same way", () => {
    const active = (threadKey: string) =>
      ({
        threadKey,
        ref: {} as never,
        branch: "main",
        projectName: "abode",
        hostLabel: null,
      }) as const;
    useStatusBarStore.getState().publishActive(active("a"));
    const before = useStatusBarStore.getState();
    useStatusBarStore.getState().publishActive(active("a"));
    expect(useStatusBarStore.getState()).toBe(before);
    useStatusBarStore.getState().publishActive(active("b"));
    useStatusBarStore.getState().clearActive("a");
    expect(useStatusBarStore.getState().active?.threadKey).toBe("b");
  });
});
