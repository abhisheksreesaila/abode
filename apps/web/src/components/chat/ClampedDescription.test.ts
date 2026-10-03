import { describe, expect, it } from "vite-plus/test";

import { isTextClamped } from "./ClampedDescription";

describe("isTextClamped", () => {
  it("is false when the text fits its box", () => {
    expect(isTextClamped({ scrollHeight: 32, clientHeight: 32 })).toBe(false);
    expect(isTextClamped({ scrollHeight: 33, clientHeight: 32 })).toBe(false);
  });

  it("is true when the content is taller than the clamped box", () => {
    expect(isTextClamped({ scrollHeight: 64, clientHeight: 32 })).toBe(true);
  });
});
