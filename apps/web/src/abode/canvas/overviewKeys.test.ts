import { describe, expect, it } from "vite-plus/test";

import { overviewKeyAction, type KeyLike } from "./overviewKeys";

const key = (over: Partial<KeyLike>): KeyLike => ({
  key: "o",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  defaultPrevented: false,
  typing: false,
  ...over,
});
const closed = { open: false, layerOpen: false };

describe("overviewKeyAction", () => {
  it("toggles on a plain o", () => {
    expect(overviewKeyAction(key({}), closed)).toBe("toggle");
    expect(overviewKeyAction(key({}), { open: true, layerOpen: false })).toBe("toggle");
  });
  it("ignores o while typing, with a modifier or already handled", () => {
    expect(overviewKeyAction(key({ typing: true }), closed)).toBeNull();
    expect(overviewKeyAction(key({ ctrlKey: true }), closed)).toBeNull();
    expect(overviewKeyAction(key({ metaKey: true }), closed)).toBeNull();
    expect(overviewKeyAction(key({ defaultPrevented: true }), closed)).toBeNull();
  });
  it("closes on Esc only when open and no layer is above", () => {
    const esc = key({ key: "Escape" });
    expect(overviewKeyAction(esc, { open: true, layerOpen: false })).toBe("close");
    expect(overviewKeyAction(esc, { open: true, layerOpen: true })).toBeNull();
    expect(overviewKeyAction(esc, closed)).toBeNull();
    expect(
      overviewKeyAction(key({ key: "Escape", defaultPrevented: true }), {
        open: true,
        layerOpen: false,
      }),
    ).toBeNull();
  });
});
