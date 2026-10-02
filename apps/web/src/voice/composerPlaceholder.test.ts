import { describe, expect, it } from "vite-plus/test";
import { fluentReplyPlaceholder } from "./composerPlaceholder";

describe("fluentReplyPlaceholder", () => {
  it("names the configured voice key", () => {
    const text = fluentReplyPlaceholder({ enabled: true, shortcut: "ctrl+shift+space" }, "abode");
    expect(text).toMatch(/^Reply, or hold .+ to talk$/);
    expect(text).toContain("Space");
  });
  it("follows a rebound key", () => {
    expect(fluentReplyPlaceholder({ enabled: true, shortcut: "alt+v" }, "abode")).toContain("V");
  });
  it("drops the voice hint when voice is off", () => {
    expect(fluentReplyPlaceholder({ enabled: false, shortcut: "alt+v" }, "abode")).toBe(
      "Reply to the agent",
    );
  });
  it("leaves other themes alone", () => {
    expect(fluentReplyPlaceholder({ enabled: true, shortcut: "alt+v" }, "t3-chat")).toBeNull();
    expect(fluentReplyPlaceholder({ enabled: true, shortcut: "alt+v" }, undefined)).toBeNull();
  });
});
