import { describe, expect, it } from "vite-plus/test";

import {
  endsWithAutonomousDoneMarker,
  formatAutoContinueLabel,
  parseAutoContinueMessage,
} from "./autonomous.ts";

describe("parseAutoContinueMessage", () => {
  it("reads the count and cap from the nudge prefix", () => {
    expect(parseAutoContinueMessage("[abode:auto 3/30]\nContinue working")).toEqual({
      count: 3,
      cap: 30,
    });
  });

  it("leaves ordinary user text alone", () => {
    expect(parseAutoContinueMessage("please [abode:auto 3/30]")).toBeNull();
    expect(parseAutoContinueMessage("continue")).toBeNull();
  });

  it("round-trips into the compact label", () => {
    expect(formatAutoContinueLabel(3, 30)).toBe("↻ auto-continue 3/30");
  });
});

describe("endsWithAutonomousDoneMarker", () => {
  it("accepts the marker at the end, with or without decoration", () => {
    expect(endsWithAutonomousDoneMarker("Done.\nABODE:DONE")).toBe(true);
    expect(endsWithAutonomousDoneMarker("`ABODE:DONE`\n")).toBe(true);
  });

  it("rejects the marker anywhere else", () => {
    expect(endsWithAutonomousDoneMarker("ABODE:DONE is how I will finish")).toBe(false);
  });
});
