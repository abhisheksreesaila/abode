import { describe, expect, it } from "vite-plus/test";

import { ABODE_THEME } from "../../themePalette";

// Mirrors the --chip-* values in index.css. Role colors for the default themes
// are the Tailwind shades that index.css maps to --error, --warning and
// --success; abode's come from its palette. Hover keeps the resting fill (only
// the border changes), so one ratio covers rest and hover.
const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
const mix = (a: string, b: string, weightOfA: number) =>
  `#${rgb(a)
    .map((channel, i) =>
      Math.round(channel * weightOfA + rgb(b)[i]! * (1 - weightOfA))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

interface Tint {
  readonly base: string;
  readonly fg: string;
  readonly fill: number;
  /** Risk tints pull their role foreground 40% toward --foreground. */
  readonly risk?: boolean;
}
interface Scheme {
  readonly foreground: string;
  readonly backgrounds: readonly string[];
  readonly tints: Readonly<Record<string, Tint>>;
}

const darkHues = {
  purple: { base: "#c586c0", fg: "#d9a6d5", fill: 13 },
  blue: { base: "#4fc1ff", fg: "#8fd3ff", fill: 12 },
  teal: { base: "#4ec9b0", fg: "#7fdcc8", fill: 12 },
};
const abode = ABODE_THEME.colors;

const schemes: Readonly<Record<string, Scheme>> = {
  abode: {
    foreground: abode.text,
    backgrounds: [abode.surfaceRaised, abode.canvas],
    tints: {
      danger: { base: "#f14c4c", fg: "#ff8a8a", fill: 16, risk: true },
      caution: { base: abode.warning, fg: abode.warningForeground, fill: 14, risk: true },
      safe: { base: "#10b981", fg: "#34d399", fill: 12, risk: true },
      ...darkHues,
    },
  },
  "default dark": {
    foreground: "#f5f5f5",
    backgrounds: ["#0a0a0a", "#101010"],
    tints: {
      danger: { base: "#ef4444", fg: "#f87171", fill: 16, risk: true },
      caution: { base: "#f59e0b", fg: "#fbbf24", fill: 14, risk: true },
      safe: { base: "#10b981", fg: "#34d399", fill: 12, risk: true },
      ...darkHues,
    },
  },
  light: {
    foreground: "#27272a",
    backgrounds: ["#ffffff", "#fcfcfc"],
    tints: {
      danger: { base: "#ef4444", fg: "#b91c1c", fill: 16, risk: true },
      caution: { base: "#f59e0b", fg: "#b45309", fill: 14, risk: true },
      safe: { base: "#10b981", fg: "#047857", fill: 12, risk: true },
      purple: { base: "#a64ca0", fg: "#7d2f78", fill: 13 },
      blue: { base: "#0a7fc2", fg: "#05588a", fill: 12 },
      teal: { base: "#12907b", fg: "#0b6657", fill: 12 },
    },
  },
};

describe("chip contrast", () => {
  for (const [name, scheme] of Object.entries(schemes)) {
    for (const background of scheme.backgrounds) {
      for (const [tint, { base, fg, fill, risk }] of Object.entries(scheme.tints)) {
        it(`${tint} text is at least 4.5:1 in ${name} on ${background}`, () => {
          const text = risk ? mix(fg, scheme.foreground, 0.6) : fg;
          expect(contrast(text, mix(base, background, fill / 100))).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});
