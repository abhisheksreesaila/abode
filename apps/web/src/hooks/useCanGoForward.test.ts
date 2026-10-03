import { describe, expect, it } from "vite-plus/test";

import { advanceHistoryTip, canGoForwardAt } from "./useCanGoForward";

describe("history tip", () => {
  it("is at the tip after pushes, and back reveals a forward entry", () => {
    let tip = 0;
    tip = advanceHistoryTip(tip, "PUSH", 1);
    tip = advanceHistoryTip(tip, "PUSH", 2);
    expect(canGoForwardAt(tip, 2)).toBe(false);
    tip = advanceHistoryTip(tip, "BACK", 1);
    expect(canGoForwardAt(tip, 1)).toBe(true);
    tip = advanceHistoryTip(tip, "FORWARD", 2);
    expect(canGoForwardAt(tip, 2)).toBe(false);
  });

  it("drops forward entries when pushing from the middle", () => {
    let tip = advanceHistoryTip(advanceHistoryTip(0, "PUSH", 1), "PUSH", 2);
    tip = advanceHistoryTip(tip, "BACK", 0);
    tip = advanceHistoryTip(tip, "PUSH", 1);
    expect(canGoForwardAt(tip, 1)).toBe(false);
  });

  it("keeps forward entries across a replace", () => {
    let tip = advanceHistoryTip(advanceHistoryTip(0, "PUSH", 1), "PUSH", 2);
    tip = advanceHistoryTip(tip, "BACK", 1);
    tip = advanceHistoryTip(tip, "REPLACE", 1);
    expect(canGoForwardAt(tip, 1)).toBe(true);
  });
});
