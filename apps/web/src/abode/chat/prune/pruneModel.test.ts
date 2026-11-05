import { describe, expect, it } from "vite-plus/test";

import { parsePruneBlock, pruneHeadline, rowTokens } from "./pruneModel";

describe("parsePruneBlock", () => {
  it("reads name | reason | tokens per line", () => {
    expect(
      parsePruneBlock(
        "grill-me | overlaps with grilling | 180\ngstack:qa | never used, 4mo | ~1,250 tok",
      ),
    ).toEqual([
      { name: "grill-me", reason: "overlaps with grilling", tokens: 180 },
      { name: "gstack:qa", reason: "never used, 4mo", tokens: 1250 },
    ]);
  });

  it("keeps a reason that contains a bar, and a line with no token figure", () => {
    expect(parsePruneBlock("a | x | y | 40\nb | just a reason")).toEqual([
      { name: "a", reason: "x | y", tokens: 40 },
      { name: "b", reason: "just a reason", tokens: null },
    ]);
  });

  it("skips blank lines, comments, bullets' markers and lines without a skill name", () => {
    expect(
      parsePruneBlock("# why\n\n- `tdd` | dup | 10\n| no name | 5\nnot a name! | x | 1"),
    ).toEqual([{ name: "tdd", reason: "dup", tokens: 10 }]);
  });

  it("keeps the first line of a name listed twice", () => {
    expect(parsePruneBlock("a | one | 1\na | two | 2")).toEqual([
      { name: "a", reason: "one", tokens: 1 },
    ]);
  });

  it("returns nothing for an empty block", () => {
    expect(parsePruneBlock("")).toEqual([]);
  });
});

describe("rowTokens and pruneHeadline", () => {
  it("prefers the agent's figure, then the measured copies added up, then zero", () => {
    expect(rowTokens({ name: "a", reason: "", tokens: 5 }, [9])).toBe(5);
    expect(rowTokens({ name: "a", reason: "", tokens: null }, [9, 4])).toBe(13);
    expect(rowTokens({ name: "a", reason: "", tokens: null }, [])).toBe(0);
  });
  it("words the header", () => {
    expect(pruneHeadline(3, 1430)).toBe("I'd cut 3 · saves 1,430 tokens per session");
  });
});
