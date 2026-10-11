import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_VOICE_SHORTCUT } from "./shortcut";
import { captureVoiceShortcut, findVoiceShortcutConflict } from "./shortcutCapture";

const key = (overrides: Partial<Parameters<typeof captureVoiceShortcut>[0]>) => ({
  key: " ",
  code: "Space",
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
});

describe("captureVoiceShortcut", () => {
  it("records a modified key as a stored shortcut", () => {
    expect(captureVoiceShortcut(key({ ctrlKey: true, shiftKey: true }), "Linux")).toEqual({
      kind: "shortcut",
      value: "mod+shift+space",
    });
  });

  it("cancels on Escape and ignores bare keys and lone modifiers", () => {
    expect(captureVoiceShortcut(key({ key: "Escape", code: "Escape" }), "Linux")).toEqual({
      kind: "cancel",
    });
    expect(captureVoiceShortcut(key({ key: "a", code: "KeyA" }), "Linux")).toEqual({
      kind: "ignore",
    });
    expect(
      captureVoiceShortcut(key({ key: "Control", code: "ControlLeft", ctrlKey: true }), "Linux"),
    ).toEqual({ kind: "ignore" });
  });
});

describe("findVoiceShortcutConflict", () => {
  it("accepts the default key because no built-in binding uses it", () => {
    expect(findVoiceShortcutConflict(DEFAULT_VOICE_SHORTCUT, "Linux")).toBeNull();
  });

  it("names the built-in command a new key would shadow", () => {
    expect(findVoiceShortcutConflict("mod+shift+p", "Linux")).toBe("thread.pin");
  });
});
