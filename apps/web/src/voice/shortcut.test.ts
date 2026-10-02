import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_VOICE_SHORTCUT,
  isShortcutRelease,
  matchesVoiceShortcut,
  voiceShortcutLabel,
} from "./shortcut";

const base = {
  key: " ",
  code: "Space",
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};

describe("voice shortcut", () => {
  it("defaults to Ctrl+Shift+Space, which no built-in T3 binding uses", () => {
    expect(DEFAULT_VOICE_SHORTCUT).toBe("ctrl+shift+space");
    expect(
      matchesVoiceShortcut(
        { ...base, ctrlKey: true, shiftKey: true },
        DEFAULT_VOICE_SHORTCUT,
        "Linux",
      ),
    ).toBe(true);
  });

  it("requires the exact modifier set", () => {
    expect(matchesVoiceShortcut({ ...base, ctrlKey: true }, DEFAULT_VOICE_SHORTCUT, "Linux")).toBe(
      false,
    );
    expect(
      matchesVoiceShortcut(
        { ...base, ctrlKey: true, shiftKey: true, altKey: true },
        DEFAULT_VOICE_SHORTCUT,
        "Linux",
      ),
    ).toBe(false);
  });

  it("treats mod as Cmd on macOS and Ctrl elsewhere", () => {
    const event = { ...base, key: "d", code: "KeyD" };
    expect(matchesVoiceShortcut({ ...event, metaKey: true }, "mod+d", "MacIntel")).toBe(true);
    expect(matchesVoiceShortcut({ ...event, ctrlKey: true }, "mod+d", "Linux")).toBe(true);
    expect(matchesVoiceShortcut({ ...event, ctrlKey: true }, "mod+d", "MacIntel")).toBe(false);
  });

  it("returns false for an unparseable stored shortcut instead of throwing", () => {
    expect(matchesVoiceShortcut(base, "not a shortcut+++", "Linux")).toBe(false);
  });

  it("releases when the main key or a required modifier comes up", () => {
    expect(isShortcutRelease(base, DEFAULT_VOICE_SHORTCUT, "Linux")).toBe(true);
    expect(
      isShortcutRelease(
        { ...base, key: "Control", code: "ControlLeft" },
        DEFAULT_VOICE_SHORTCUT,
        "Linux",
      ),
    ).toBe(true);
    expect(
      isShortcutRelease({ ...base, key: "Alt", code: "AltLeft" }, DEFAULT_VOICE_SHORTCUT, "Linux"),
    ).toBe(false);
    expect(
      isShortcutRelease({ ...base, key: "a", code: "KeyA" }, DEFAULT_VOICE_SHORTCUT, "Linux"),
    ).toBe(false);
  });

  it("labels the shortcut for display", () => {
    expect(voiceShortcutLabel(DEFAULT_VOICE_SHORTCUT, "Linux")).toBe("Ctrl+Shift+Space");
  });
});
