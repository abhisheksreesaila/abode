import { describe, expect, it } from "vite-plus/test";

import { controlRoomVisible } from "./controlRoomVisible";

describe("controlRoomVisible", () => {
  it("shows the table once shells are loaded and a project exists", () => {
    expect(controlRoomVisible({ bootstrapped: true, projectCount: 2 })).toBe(true);
  });

  it("falls back to upstream's landing with no projects", () => {
    expect(controlRoomVisible({ bootstrapped: true, projectCount: 0 })).toBe(false);
  });

  it("waits for the shells instead of flashing the empty hero", () => {
    expect(controlRoomVisible({ bootstrapped: false, projectCount: 3 })).toBe(false);
  });
});
