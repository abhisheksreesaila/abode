import { describe, expect, it } from "vite-plus/test";

import { sidebarAction } from "./sidebarFlag";

describe("sidebarAction", () => {
  it("collapses when the flag turns on", () => {
    expect(sidebarAction({ prev: false, next: true, open: true })).toBe("collapse");
    expect(sidebarAction({ prev: false, next: true, open: false })).toBe("collapse");
  });
  it("expands when the flag turns off", () => {
    expect(sidebarAction({ prev: true, next: false, open: false })).toBe("expand");
  });
  it("on load, collapses an open sidebar when the flag is on", () => {
    expect(sidebarAction({ prev: null, next: true, open: true })).toBe("collapse");
  });
  it("on load, leaves an already closed sidebar, or a flag that is off, alone", () => {
    expect(sidebarAction({ prev: null, next: true, open: false })).toBe("none");
    expect(sidebarAction({ prev: null, next: false, open: true })).toBe("none");
    expect(sidebarAction({ prev: null, next: false, open: false })).toBe("none");
  });
  it("leaves manual toggles alone while the flag stays the same", () => {
    expect(sidebarAction({ prev: true, next: true, open: true })).toBe("none");
    expect(sidebarAction({ prev: false, next: false, open: false })).toBe("none");
  });
});
