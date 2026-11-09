import { describe, expect, it } from "@effect/vitest";

import { requestHeaders } from "./skillSourcesIO.ts";

describe("requestHeaders", () => {
  it("asks GitHub for its media type and npm for plain JSON (npm answers 406 otherwise)", () => {
    expect(requestHeaders("https://api.github.com/repos/a/b/git/trees/HEAD").accept).toBe(
      "application/vnd.github+json",
    );
    expect(requestHeaders("https://registry.npmjs.org/skills/latest").accept).toBe(
      "application/json",
    );
  });
});
