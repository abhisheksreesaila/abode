import { describe, expect, it } from "vite-plus/test";
import { fluentReplyPlaceholder } from "./composerPlaceholder";

describe("fluentReplyPlaceholder", () => {
  it("names the configured voice key", () => {
    const text = fluentReplyPlaceholder({ enabled: true, shortcut: "ctrl+shift+space" }, true);
    expect(text).toMatch(/^Reply, or hold .+ to talk$/);
    expect(text).toContain("Space");
  });
  it("follows a rebound key", () => {
    expect(fluentReplyPlaceholder({ enabled: true, shortcut: "alt+v" }, true)).toContain("V");
  });
  it("drops the voice hint when voice is off", () => {
    expect(fluentReplyPlaceholder({ enabled: false, shortcut: "alt+v" }, true)).toBe(
      "Reply to the agent",
    );
  });
  it("leaves other themes alone", () => {
    expect(fluentReplyPlaceholder({ enabled: true, shortcut: "alt+v" }, false)).toBeNull();
    expect(fluentReplyPlaceholder({ enabled: true, shortcut: "alt+v" }, false)).toBeNull();
  });
});
