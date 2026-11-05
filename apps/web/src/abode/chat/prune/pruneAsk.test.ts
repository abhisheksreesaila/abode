import { describe, expect, it } from "vite-plus/test";

import { pruneAskPrompt } from "./pruneAsk";

describe("pruneAskPrompt", () => {
  it("names the block format and lists each skill with source, cost and last use", () => {
    const text = pruneAskPrompt([
      { name: "tdd", source: "Matt Pocock", tokens: 90, lastUsed: "2d ago" },
      { name: "old-thing", source: "Mine", tokens: 310, lastUsed: "unknown" },
    ]);
    expect(text).toContain("fenced block tagged abode-prune");
    expect(text).toContain("`name | reason | tokens`");
    expect(text).toContain("\ntdd | Matt Pocock | 90 | 2d ago\nold-thing | Mine | 310 | unknown");
  });

  it("caps a long list and says how many were left out", () => {
    const skills = Array.from({ length: 152 }, (_, n) => ({
      name: `s${n}`,
      source: "Mine",
      tokens: 1,
      lastUsed: "today",
    }));
    const text = pruneAskPrompt(skills);
    expect(text).toContain("s149 | Mine");
    expect(text).not.toContain("s150 | Mine");
    expect(text).toContain("(+2 more not shown)");
  });
});
