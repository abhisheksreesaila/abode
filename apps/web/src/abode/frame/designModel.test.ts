import { describe, expect, it } from "vite-plus/test";

import { sanitizeDesignSeen } from "./frameStore";
import {
  collectDesigns,
  countDesigns,
  newDesignCount,
  pickPrompt,
  type DesignMessage,
} from "./designModel";

const NOW = Date.parse("2026-11-04T12:00:00Z");
const at = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const THREAD: ReadonlyArray<DesignMessage> = [
  { role: "user", text: "Design the pricing page for phone and desktop", at: at(90) },
  {
    role: "assistant",
    text: [
      "Two options, both in omxqua:",
      "- [Pricing, phone](https://claude.ai/artifact/MAxT8zMrArrRvoFEjMrcWB) at 390 wide",
      "- Desktop 1440: https://claude.ai/code/artifact/0a1b2c3d-4e5f.",
      "Saved the source to docs/design/pricing/desktop.html too.",
    ].join("\n"),
    at: at(88),
  },
  { role: "user", text: "Now try the settings screen in Stitch, mobile first please", at: at(30) },
  {
    role: "assistant",
    text: "Done: https://stitch.withgoogle.com/projects/123/screens/abc?pli=1 (mobile). Same artifact as before: https://claude.ai/artifact/MAxT8zMrArrRvoFEjMrcWB",
    at: at(28),
  },
];

describe("collectDesigns", () => {
  const groups = collectDesigns(THREAD);

  it("groups by the asking message, newest group first", () => {
    expect(groups.map((group) => group.asked)).toEqual([
      "Now try the settings screen in Stitch, mobile first please",
      "Design the pricing page for phone and desktop",
    ]);
    expect(groups.map((group) => group.at)).toEqual([NOW - 30 * 60_000, NOW - 90 * 60_000]);
  });

  it("finds Stitch, Claude and file cards with source, device and title", () => {
    expect(groups[0]!.cards).toEqual([
      {
        key: "https://stitch.withgoogle.com/projects/123/screens/abc?pli=1",
        href: "https://stitch.withgoogle.com/projects/123/screens/abc?pli=1",
        path: null,
        source: "Stitch",
        device: "phone",
        title: "Done",
        host: "stitch.withgoogle.com",
      },
    ]);
    expect(groups[1]!.cards).toEqual([
      {
        key: "https://claude.ai/artifact/MAxT8zMrArrRvoFEjMrcWB",
        href: "https://claude.ai/artifact/MAxT8zMrArrRvoFEjMrcWB",
        path: null,
        source: "Claude",
        device: "phone",
        title: "Pricing, phone",
        host: "claude.ai",
      },
      {
        key: "https://claude.ai/code/artifact/0a1b2c3d-4e5f",
        href: "https://claude.ai/code/artifact/0a1b2c3d-4e5f",
        path: null,
        source: "Claude",
        device: "desktop",
        title: "Desktop 1440",
        host: "claude.ai",
      },
      {
        key: "docs/design/pricing/desktop.html",
        href: null,
        path: "docs/design/pricing/desktop.html",
        source: "file",
        device: "desktop",
        title: "desktop.html",
        host: "docs/design/pricing",
      },
    ]);
  });

  it("shows a repeated link once, in the group that mentioned it first", () => {
    const keys = groups.flatMap((group) => group.cards.map((card) => card.key));
    expect(keys.filter((key) => key.endsWith("MAxT8zMrArrRvoFEjMrcWB"))).toHaveLength(1);
  });

  it("says no device when the text does not", () => {
    const [group] = collectDesigns([
      { role: "user", text: "show me", at: null },
      { role: "assistant", text: "Here: https://claude.ai/artifact/abc123", at: null },
    ]);
    expect(group!.at).toBeNull();
    expect(group!.cards[0]).toMatchObject({ device: null, title: "Here" });
  });

  it("returns nothing for a thread with no designs", () => {
    expect(
      collectDesigns([{ role: "user", text: "fix the bug in docs/plan.md", at: null }]),
    ).toEqual([]);
  });

  it("keeps links the user pasted in their own message", () => {
    const [group] = collectDesigns([
      { role: "user", text: "Make it look like https://stitch.withgoogle.com/x/y", at: null },
    ]);
    expect(group!.cards[0]).toMatchObject({ source: "Stitch" });
  });
});

describe("pickPrompt", () => {
  it("lists the picks with source and device", () => {
    expect(
      pickPrompt([
        { title: "Pricing, phone", source: "Claude", device: "phone" },
        { title: "settings.html", source: "file", device: null },
      ]),
    ).toBe("I pick: Pricing, phone (Claude, phone), settings.html (file)");
  });
});

describe("newDesignCount", () => {
  it("counts cards added since the tab was last opened", () => {
    expect(newDesignCount(5, 3)).toBe(2);
    expect(newDesignCount(5, undefined)).toBe(5);
    expect(newDesignCount(2, 4)).toBe(0);
  });
});

describe("sanitizeDesignSeen", () => {
  it("keeps counts and drops junk", () => {
    expect(sanitizeDesignSeen({ designSeen: { a: 3, b: -1, c: "x", d: 1.5, e: 0 } })).toEqual({
      a: 3,
      e: 0,
    });
    expect(sanitizeDesignSeen({ designSeen: [1] })).toEqual({});
    expect(sanitizeDesignSeen(null)).toEqual({});
  });
});

describe("collectDesigns edge cases", () => {
  const keysOf = (text: string) =>
    collectDesigns([{ role: "assistant", text, at: null }]).flatMap((group) =>
      group.cards.map((card) => card.key),
    );

  it("stops a link at bold, angle brackets, parentheses and sentence punctuation", () => {
    expect(keysOf("**https://claude.ai/artifact/abc123**")).toEqual([
      "https://claude.ai/artifact/abc123",
    ]);
    expect(keysOf("**https://stitch.withgoogle.com/p/1/s/2**")).toEqual([
      "https://stitch.withgoogle.com/p/1/s/2",
    ]);
    expect(
      keysOf("_https://stitch.withgoogle.com/p/1/s/2_ and ~https://claude.ai/artifact/x1~"),
    ).toEqual(["https://stitch.withgoogle.com/p/1/s/2", "https://claude.ai/artifact/x1"]);
    expect(keysOf("<https://stitch.withgoogle.com/p/1>")).toEqual([
      "https://stitch.withgoogle.com/p/1",
    ]);
    expect(keysOf("(see https://stitch.withgoogle.com/p/1/s/2?pli=1).")).toEqual([
      "https://stitch.withgoogle.com/p/1/s/2?pli=1",
    ]);
    expect(keysOf("Open https://stitch.withgoogle.com/p/1?a=b.")).toEqual([
      "https://stitch.withgoogle.com/p/1?a=b",
    ]);
  });

  it("includes links inside code fences and two links on one line", () => {
    expect(keysOf("```\nstitch url screen 9\nhttps://stitch.withgoogle.com/p/9\n```")).toEqual([
      "https://stitch.withgoogle.com/p/9",
    ]);
    expect(keysOf("A https://claude.ai/artifact/a1 and B https://claude.ai/artifact/b2")).toEqual([
      "https://claude.ai/artifact/a1",
      "https://claude.ai/artifact/b2",
    ]);
  });

  it("normalises absolute paths to the docs/design part and ignores other hosts", () => {
    expect(keysOf("wrote /home/x/proj/docs/design/a.html and ~/p/docs/design/b/c.html")).toEqual([
      "docs/design/a.html",
      "docs/design/b/c.html",
    ]);
    expect(keysOf("see https://example.com/docs/design/a.html")).toEqual([]);
  });
});

describe("countDesigns", () => {
  it("counts distinct designs across messages", () => {
    const items = [
      { text: "https://claude.ai/artifact/a1 and docs/design/x.html" },
      { text: "again https://claude.ai/artifact/a1" },
    ];
    expect(countDesigns(items)).toBe(2);
    expect(countDesigns([...items, { text: "https://stitch.withgoogle.com/p/1" }])).toBe(3);
  });
});
