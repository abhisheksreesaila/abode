import { describe, expect, it } from "vite-plus/test";
import { isFluentTheme } from "./fluentTheme";

describe("isFluentTheme", () => {
  it("is on for the abode preference", () => {
    expect(isFluentTheme({ theme: "abode", resolvedTheme: "dark" })).toBe(true);
    expect(isFluentTheme({ theme: "t3-chat", resolvedTheme: "dark" })).toBe(false);
  });
  it("follows the automatic-mode half for the resolved appearance", () => {
    expect(
      isFluentTheme({ theme: "t3-chat", resolvedTheme: "dark", themeHalves: { dark: "abode" } }),
    ).toBe(true);
    expect(
      isFluentTheme({ theme: "abode", resolvedTheme: "light", themeHalves: { light: "t3-chat" } }),
    ).toBe(false);
  });
});
