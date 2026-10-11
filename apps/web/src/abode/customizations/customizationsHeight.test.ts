import { describe, expect, it } from "vite-plus/test";

import {
  clampCustomizationsFraction,
  fractionFromDrag,
  fractionFromKey,
  parseStoredCustomizationsFraction,
} from "./customizationsHeight";

describe("customizations height", () => {
  it("clamps between collapsed and 85%", () => {
    expect(clampCustomizationsFraction(-1)).toBe(0);
    expect(clampCustomizationsFraction(0.4)).toBe(0.4);
    expect(clampCustomizationsFraction(2)).toBe(0.85);
  });

  it("parses stored values and ignores junk", () => {
    expect(parseStoredCustomizationsFraction("0.5")).toBe(0.5);
    expect(parseStoredCustomizationsFraction("5")).toBe(0.85);
    expect(parseStoredCustomizationsFraction("abc")).toBeNull();
    expect(parseStoredCustomizationsFraction("")).toBeNull();
    expect(parseStoredCustomizationsFraction(null)).toBeNull();
  });

  it("grows when dragged up and shrinks when dragged down", () => {
    const base = { startFraction: 0.3, startY: 500, containerHeight: 1000 };
    expect(fractionFromDrag({ ...base, y: 400 })).toBeCloseTo(0.4);
    expect(fractionFromDrag({ ...base, y: 600 })).toBeCloseTo(0.2);
    expect(fractionFromDrag({ ...base, y: -5000 })).toBe(0.85);
    expect(fractionFromDrag({ ...base, y: 5000 })).toBe(0);
    expect(fractionFromDrag({ ...base, containerHeight: 0, y: 0 })).toBe(0.3);
  });

  it("steps with the keyboard", () => {
    expect(fractionFromKey(0.3, "ArrowUp")).toBeCloseTo(0.34);
    expect(fractionFromKey(0.3, "ArrowDown")).toBeCloseTo(0.26);
    expect(fractionFromKey(0.3, "PageUp")).toBeCloseTo(0.42);
    expect(fractionFromKey(0.3, "Home")).toBe(0);
    expect(fractionFromKey(0.3, "End")).toBe(0.85);
    expect(fractionFromKey(0.84, "ArrowUp")).toBe(0.85);
    expect(fractionFromKey(0.3, "a")).toBeNull();
  });
});
