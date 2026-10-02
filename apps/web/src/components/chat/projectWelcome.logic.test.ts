import { describe, expect, it } from "vite-plus/test";

import {
  buildStarterPrompts,
  parseReadmeWelcome,
  pickProjectEmoji,
  shortenHomePath,
  summarizeProjectThreads,
  trimTagline,
} from "./projectWelcome.logic";

describe("parseReadmeWelcome tagline", () => {
  it("takes the first paragraph after the H1", () => {
    const md =
      "# Travel OS\n\nPlan trips like a pro: itineraries,\nbudgets and bookings.\n\nMore.\n";
    expect(parseReadmeWelcome(md).tagline).toBe(
      "Plan trips like a pro: itineraries, budgets and bookings.",
    );
  });

  it("takes a blockquote and drops its markers", () => {
    const md = "# Travel OS\n\n> Plan trips\n> like a pro\n\nBody text.";
    expect(parseReadmeWelcome(md).tagline).toBe("Plan trips like a pro");
  });

  it("skips badges, images and html wrappers between the title and the text", () => {
    const md = [
      "# Travel OS",
      "",
      '<p align="center">',
      '<img src="logo.png">',
      "</p>",
      "[![CI](https://x/y.svg)](https://x) [![npm](https://x/z.svg)](https://z)",
      "![banner](banner.png)",
      "",
      "A **bold** tool with [links](https://example.com) and `code`.",
    ].join("\n");
    expect(parseReadmeWelcome(md).tagline).toBe("A bold tool with links and code.");
  });

  it("reads an HTML title, alone or wrapped in a div", () => {
    const alone = '<h1 align="center">Travel OS</h1>\n\n<p align="center">Plan trips.</p>';
    expect(parseReadmeWelcome(alone).tagline).toBe("Plan trips.");
    const wrapped =
      '<div align="center">\n  <img src="logo.png">\n  <h1>Travel OS</h1>\n  <p><b>Plan trips</b> well.</p>\n</div>\n\n## Install';
    expect(parseReadmeWelcome(wrapped).tagline).toBe("Plan trips well.");
    expect(parseReadmeWelcome("<h1>Travel OS</h1><p>Plan trips.</p>").tagline).toBe("Plan trips.");
  });

  it("skips reference-style badges and their definitions", () => {
    const md = [
      "# Travel OS",
      "",
      "[![CI][ci-badge]][ci-link] ![npm][npm-badge]",
      "",
      "[ci-badge]: https://x/y.svg",
      "[ci-link]: https://x",
      "[npm-badge]: https://x/z.svg",
      "",
      "Plan trips.",
    ].join("\n");
    expect(parseReadmeWelcome(md).tagline).toBe("Plan trips.");
  });

  it("understands a setext title", () => {
    expect(parseReadmeWelcome("Travel OS\n=========\n\nPlan trips.").tagline).toBe("Plan trips.");
  });

  it("ignores front matter and html comments", () => {
    const md = "---\ntitle: x\n---\n<!-- note -->\n# Title\n\nThe tagline.";
    expect(parseReadmeWelcome(md).tagline).toBe("The tagline.");
  });

  it("has no tagline when a heading follows the title or the next block is not prose", () => {
    expect(parseReadmeWelcome("# Title\n\n## Install\n\nText").tagline).toBeNull();
    expect(parseReadmeWelcome("# Title\n\n- one\n- two").tagline).toBeNull();
    expect(parseReadmeWelcome("# Title\n\n```sh\nnpm i\n```").tagline).toBeNull();
    expect(parseReadmeWelcome("# Title").tagline).toBeNull();
    expect(parseReadmeWelcome("").tagline).toBeNull();
  });

  it("uses the first paragraph when there is no title", () => {
    expect(parseReadmeWelcome("Just some words.\n\nMore.").tagline).toBe("Just some words.");
  });

  it("does not read a # comment inside a code fence as the title", () => {
    const md = "```sh\n# not a title\n```\n\n# Real\n\nTagline.";
    expect(parseReadmeWelcome(md).tagline).toBe("Tagline.");
  });
});

describe("parseReadmeWelcome emoji", () => {
  it("takes the first emoji near the top", () => {
    expect(parseReadmeWelcome("# 🧳 Travel OS\n\nPlan ✈️ trips.").emoji).toBe("🧳");
  });

  it("keeps variation selectors and joined sequences whole", () => {
    expect(parseReadmeWelcome("# Travel ✈️").emoji).toBe("✈️");
    expect(parseReadmeWelcome("# Family 👨‍👩‍👧").emoji).toBe("👨‍👩‍👧");
  });

  it("ignores copyright and trademark signs, digits and plain text", () => {
    expect(parseReadmeWelcome("# Acme™ © 2026 1").emoji).toBeNull();
  });

  it("accepts only presentation emoji: bare text symbols do not count", () => {
    expect(parseReadmeWelcome("# Done ✔ ➡ ☑").emoji).toBeNull();
    expect(parseReadmeWelcome("# Done ✔ ✔️").emoji).toBe("✔️");
    expect(parseReadmeWelcome("# Ship ✅").emoji).toBe("✅");
  });

  it("is null when there is none", () => {
    expect(parseReadmeWelcome("# Title\n\nText").emoji).toBeNull();
  });
});

describe("trimTagline", () => {
  it("leaves short text alone and collapses whitespace", () => {
    expect(trimTagline("  a   b \n c ")).toBe("a b c");
  });

  it("cuts long text at a word boundary with an ellipsis, within the limit", () => {
    const text = "word ".repeat(60);
    const out = trimTagline(text, 140);
    expect(out.length).toBeLessThanOrEqual(140);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });

  it("hard-cuts a long unbroken string", () => {
    const out = trimTagline("x".repeat(300), 140);
    expect(out).toHaveLength(140);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("pickProjectEmoji", () => {
  it("is stable for a name and always returns an emoji", () => {
    expect(pickProjectEmoji("Travel OS")).toBe(pickProjectEmoji("Travel OS"));
    expect(pickProjectEmoji("")).toBe("📁");
    expect(pickProjectEmoji("abode")).toMatch(/\p{Extended_Pictographic}/u);
  });

  it("spreads different names over different emoji", () => {
    const picks = new Set(
      ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"].map(pickProjectEmoji),
    );
    expect(picks.size).toBeGreaterThan(3);
  });
});

describe("shortenHomePath", () => {
  it("abbreviates the home directory", () => {
    expect(shortenHomePath("/home/ada/code/travel-os")).toBe("~/code/travel-os");
    expect(shortenHomePath("/Users/ada/code/x")).toBe("~/code/x");
    expect(shortenHomePath("/home/ada")).toBe("~");
    expect(shortenHomePath("/srv/app")).toBe("/srv/app");
    expect(shortenHomePath("C:\\Users\\ada\\code")).toBe("C:\\Users\\ada\\code");
  });
});

describe("summarizeProjectThreads", () => {
  const thread = (
    title: string,
    updatedAt: string,
    extra: { archivedAt?: string | null; running?: boolean } = {},
  ) => ({
    id: title,
    title,
    updatedAt,
    archivedAt: extra.archivedAt ?? null,
    session: extra.running ? { status: "running" } : null,
  });

  it("counts open threads, running ones and finds the latest", () => {
    const summary = summarizeProjectThreads([
      thread("Old", "2026-01-01T00:00:00Z"),
      thread("Booking flow", "2026-03-01T00:00:00Z", { running: true }),
      thread("Gone", "2026-04-01T00:00:00Z", { archivedAt: "2026-04-02T00:00:00Z" }),
    ]);
    expect(summary.total).toBe(2);
    expect(summary.running).toBe(1);
    expect(summary.latest?.title).toBe("Booking flow");
  });

  it("is empty with no threads", () => {
    expect(summarizeProjectThreads([])).toEqual({ total: 0, running: 0, latest: null });
  });
});

describe("buildStarterPrompts", () => {
  it("names the project in the explain prompt", () => {
    const prompts = buildStarterPrompts("Travel OS");
    expect(prompts.explain).toContain("Travel OS");
    expect(prompts.feature.length).toBeGreaterThan(0);
    expect(prompts.bug.length).toBeGreaterThan(0);
  });
});
