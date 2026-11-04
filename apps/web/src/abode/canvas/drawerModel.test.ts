import { describe, expect, it } from "vite-plus/test";

import { drawerStatus, modelChipText } from "./drawerModel";
import { useDrawerStore } from "./drawerStore";

describe("modelChipText", () => {
  it("names the provider and the model", () => {
    expect(modelChipText({ dots: ["claude"] }, "opus")).toBe("Claude · opus");
  });
  it("adds the delegate that builds", () => {
    expect(modelChipText({ dots: ["claude", "codex"] }, "opus")).toBe(
      "Claude · opus → Codex builds",
    );
  });
  it("drops an unknown model", () => {
    expect(modelChipText({ dots: ["pi"] }, "")).toBe("Pi");
  });
});

describe("drawerStatus", () => {
  it("prefers a status the user must act on over running", () => {
    expect(drawerStatus({ running: true, status: "waiting on you" })).toBe("waiting on you");
  });
  it("says running or idle otherwise", () => {
    expect(drawerStatus({ running: true, status: null })).toBe("running");
    expect(drawerStatus({ running: false, status: null })).toBe("idle");
  });
});

describe("useDrawerStore", () => {
  it("opens on a session and closes", () => {
    useDrawerStore.getState().open("env:t1");
    expect(useDrawerStore.getState().sessionKey).toBe("env:t1");
    useDrawerStore.getState().close();
    expect(useDrawerStore.getState().sessionKey).toBeNull();
  });
});
