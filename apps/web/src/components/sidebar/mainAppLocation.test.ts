import { describe, expect, it } from "vite-plus/test";

import { isSidebarUtilityPage, resolveMainAppHref } from "./mainAppLocation";

describe("Back target", () => {
  it("returns to the remembered session route", () => {
    expect(resolveMainAppHref("/env-1/thread-9")).toBe("/env-1/thread-9");
  });
  it("falls back to home with no history", () => {
    expect(resolveMainAppHref(null)).toBe("/");
  });
  it("treats settings, usage and pull requests as utility pages", () => {
    for (const path of ["/settings", "/settings/connections", "/usage", "/pull-requests"]) {
      expect(isSidebarUtilityPage(path)).toBe(true);
    }
    expect(isSidebarUtilityPage("/env-1/thread-9")).toBe(false);
    expect(isSidebarUtilityPage("/")).toBe(false);
  });
});
