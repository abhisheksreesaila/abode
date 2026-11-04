import { describe, expect, it } from "vite-plus/test";

import { newKeys } from "./freshMoment";

describe("newKeys", () => {
  it("finds the item that was added", () => {
    expect(newKeys(["a", "b"], ["a", "b", "c"])).toEqual(["c"]);
  });
  it("finds nothing when items are only removed or reordered", () => {
    expect(newKeys(["a", "b"], ["b"])).toEqual([]);
    expect(newKeys(["a", "b"], ["b", "a"])).toEqual([]);
  });
  it("treats the first and the first non-empty snapshot as loading, not creation", () => {
    expect(newKeys(null, ["a", "b"])).toEqual([]);
    expect(newKeys([], ["a", "b"])).toEqual([]);
  });
});
