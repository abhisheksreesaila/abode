import { describe, expect, it } from "vite-plus/test";

import { controlRoomView } from "./controlRoomVisible";

describe("controlRoomView", () => {
  it("shows the room once shells are loaded and a project exists", () => {
    expect(controlRoomView({ bootstrapped: true, projectCount: 2 })).toBe("room");
  });

  it("falls back to upstream's landing with no projects", () => {
    expect(controlRoomView({ bootstrapped: true, projectCount: 0 })).toBe("fallback");
  });

  it("waits while projects load, so upstream's landing can't redirect to a new draft", () => {
    expect(controlRoomView({ bootstrapped: false, projectCount: 3 })).toBe("wait");
  });

  it("falls back before any project arrives", () => {
    expect(controlRoomView({ bootstrapped: false, projectCount: 0 })).toBe("fallback");
  });
});
