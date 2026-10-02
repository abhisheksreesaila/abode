import { RESERVED_THEME_IDS } from "@t3tools/shared/themePalettes";
import { describe, expect, it } from "vite-plus/test";

import {
  ABODE_THEME,
  DEFAULT_THEME_ID,
  GROVE_THEME,
  getThemeDefinition,
  isKnownThemePreference,
  singleAppearanceOf,
  themeColorToHex,
} from "./themePalette";

function hex(value: string): string {
  const converted = themeColorToHex(value);
  if (!converted) throw new Error(`not a color: ${value}`);
  return converted.slice(0, 7);
}

function contrast(first: string, second: string): number {
  const luminance = (value: string) => {
    const channels = [1, 3, 5].map((i) => Number.parseInt(hex(value).slice(i, i + 2), 16) / 255);
    const [r, g, b] = channels.map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [hi, lo] = [luminance(first), luminance(second)].toSorted((a, b) => b - a);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("abode theme", () => {
  const c = ABODE_THEME.colors;

  it("is the default and resolves like any built-in", () => {
    expect(DEFAULT_THEME_ID).toBe("abode");
    expect(isKnownThemePreference("abode")).toBe(true);
    expect(getThemeDefinition("abode")).toBe(ABODE_THEME);
    expect(RESERVED_THEME_IDS.has("abode")).toBe(true);
  });

  it("is dark only, and the other themes still resolve", () => {
    expect(singleAppearanceOf(ABODE_THEME)).toBe("dark");
    expect(getThemeDefinition("grove")).toBe(GROVE_THEME);
    expect(getThemeDefinition("t3-chat")?.id).toBe("t3-chat");
  });

  it("matches the handoff tokens", () => {
    expect(hex(c.canvas)).toBe("#1f1f1f");
    expect(hex(c.sidebar)).toBe("#181818");
    expect(hex(c.surfaceRaised)).toBe("#252526");
    expect(hex(c.input)).toBe("#313131");
    expect(hex(c.border)).toBe("#2b2b2b");
    expect(hex(c.accent)).toBe("#0078d4");
    expect(hex(c.sidebarRowActive)).toBe("#04395e");
  });

  it("keeps text readable on the surfaces it sits on", () => {
    const pairs: ReadonlyArray<[string, string, number]> = [
      [c.text, c.canvas, 7],
      [c.textMuted, c.canvas, 4.5],
      [c.sidebarForeground, c.sidebar, 7],
      [c.sidebarMutedForeground, c.sidebar, 4.5],
      [c.sidebarForeground, c.sidebarRowActive, 4.5],
      [c.mutedForeground, c.muted, 4.5],
      [c.placeholder, c.surfaceRaised, 4.5],
      [c.secondaryForeground, c.secondary, 4.5],
      [c.messageForeground, c.messageSurface, 4.5],
      [c.accentForeground, c.accent, 4.5],
      [c.messageActionForeground, c.messageAction, 4.5],
      [c.errorForeground, c.errorSurface, 4.5],
      [c.warningForeground, c.warningSurface, 4.5],
      [c.updateForeground, c.updateSurface, 4.5],
      [c.codeForeground, c.codeBackground, 7],
      [c.terminalForeground, c.terminalBackground, 7],
    ];
    for (const [fg, bg, min] of pairs) {
      expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
    }
  });
});
