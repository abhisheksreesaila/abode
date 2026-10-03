import { describe, expect, it } from "vite-plus/test";

import {
  resolveMotionDurationMs,
  seedMotionMs,
  routeSection,
  shouldFadeRoute,
} from "./routeMotion";

describe("motion duration", () => {
  it("keeps the chosen duration, and 0 stays Off", () => {
    expect(resolveMotionDurationMs(250, false)).toBe(250);
    expect(resolveMotionDurationMs(0, false)).toBe(0);
  });
  it("is off under reduced motion", () => {
    expect(resolveMotionDurationMs(250, true)).toBe(0);
  });
  it("seeds from a chosen upstream duration, else 175", () => {
    expect(seedMotionMs(300)).toBe(300);
    expect(seedMotionMs(0)).toBe(175);
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
