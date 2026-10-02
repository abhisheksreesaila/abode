import { assert, describe, it } from "@effect/vitest";

import { parsePorcelainDeletedPath } from "./GitVcsDriverCore.ts";

describe("parsePorcelainDeletedPath", () => {
  it("finds a file deleted in the worktree or the index", () => {
    assert.strictEqual(
      parsePorcelainDeletedPath("1 .D N... 100644 100644 000000 abc def src/gone.ts"),
      "src/gone.ts",
    );
    assert.strictEqual(
      parsePorcelainDeletedPath("1 D. N... 100644 000000 000000 abc def old.ts"),
      "old.ts",
    );
  });

  it("ignores modified, untracked and renamed entries", () => {
    assert.isNull(parsePorcelainDeletedPath("1 .M N... 100644 100644 100644 abc def a.ts"));
    assert.isNull(parsePorcelainDeletedPath("? new-dir/"));
    assert.isNull(parsePorcelainDeletedPath("2 R. N... 100644 100644 100644 abc def R100 b.ts\ta.ts"));
  });
});
