import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { getThemeColorsForMode, getThemeDefinition, isKnownThemePreference } from "../themePalette";
import { ABODE_THEME, ABODE_THEME_ID } from "./abodeTheme";

function stubStorage(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("abode theme registration", () => {
  it("is a known theme with dark and light halves", () => {
    expect(isKnownThemePreference(ABODE_THEME_ID)).toBe(true);
    expect(getThemeDefinition(ABODE_THEME_ID)?.label).toBe("abode");
    expect(getThemeColorsForMode(ABODE_THEME, "dark")?.canvas).toBe("#1f1f1f");
    expect(getThemeColorsForMode(ABODE_THEME, "light")).not.toBeNull();
  });
});

describe("default theme rule", () => {
  it("starts a fresh profile on abode, following the system appearance", async () => {
    stubStorage({});
    const { readThemePreference, readAppearanceModePreference } = await import("../hooks/useTheme");
    expect(readThemePreference()).toBe(ABODE_THEME_ID);
    expect(readAppearanceModePreference(readThemePreference())).toBe("system");
  });

  it("starts on abode when the stored value is unknown", async () => {
    stubStorage({ "t3code:theme": "does-not-exist" });
    const { readThemePreference } = await import("../hooks/useTheme");
    expect(readThemePreference()).toBe(ABODE_THEME_ID);
  });

  it("keeps a theme the user already picked", async () => {
    stubStorage({ "t3code:theme": "ocean" });
    const { readThemePreference, readAppearanceModePreference } = await import("../hooks/useTheme");
    expect(readThemePreference()).toBe("ocean");
    expect(readAppearanceModePreference("ocean")).toBe("light");
  });

  it("keeps an explicit system, light or dark choice", async () => {
    const { readThemePreference } = await import("../hooks/useTheme");
    for (const choice of ["system", "light", "dark"]) {
      stubStorage({ "t3code:theme": choice });
      expect(readThemePreference()).toBe(choice);
    }
  });
});
