import { describe, expect, it } from "vite-plus/test";

import { resolveMotionDurationMs, routeSection, shouldFadeRoute } from "./routeMotion";

describe("resolveMotionDurationMs", () => {
  it("falls back to 180ms when the stored setting is the contract default of 0", () => {
    expect(resolveMotionDurationMs(0, false)).toBe(180);
  });
  it("keeps an explicit duration", () => {
    expect(resolveMotionDurationMs(250, false)).toBe(250);
  });
  it("is off under reduced motion", () => {
    expect(resolveMotionDurationMs(250, true)).toBe(0);
    expect(resolveMotionDurationMs(0, true)).toBe(0);
  });
});

describe("route fade", () => {
  it("classifies utility pages", () => {
    expect(routeSection("/settings/general")).toBe("utility");
    expect(routeSection("/usage")).toBe("utility");
    expect(routeSection("/pull-requests")).toBe("utility");
    expect(routeSection("/env/thread")).toBe("session");
  });
  it("fades only across sections", () => {
    expect(shouldFadeRoute(null, "/settings")).toBe(false);
    expect(shouldFadeRoute("/env/t1", "/settings")).toBe(true);
    expect(shouldFadeRoute("/usage", "/env/t1")).toBe(true);
    expect(shouldFadeRoute("/settings/general", "/settings/providers")).toBe(false);
    expect(shouldFadeRoute("/env/t1", "/env/t2")).toBe(false);
  });
});
