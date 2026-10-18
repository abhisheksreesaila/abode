import { describe, expect, it } from "vite-plus/test";

import { pickFallbackThread } from "./scopeFallback";

const thread = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  archivedAt: null,
  latestUserMessageAt: null,
  updatedAt: "2026-10-01T00:00:00.000Z",
  createdAt: "2026-10-01T00:00:00.000Z",
  lineage: { relationshipToParent: null },
  ...over,
});

describe("pickFallbackThread", () => {
  it("picks the most recently active session", () => {
    const picked = pickFallbackThread([
      thread("old"),
      thread("new", { latestUserMessageAt: "2026-10-17T00:00:00.000Z" }),
    ]);
    expect(picked?.id).toBe("new");
  });
  it("skips archived sessions and subagents", () => {
    const picked = pickFallbackThread([
      thread("a", {
        archivedAt: "2026-10-17T00:00:00.000Z",
        updatedAt: "2026-10-17T00:00:00.000Z",
      }),
      thread("s", {
        lineage: { relationshipToParent: "subagent" },
        updatedAt: "2026-10-18T00:00:00.000Z",
      }),
      thread("ok"),
    ]);
    expect(picked?.id).toBe("ok");
  });
  it("is null with no sessions", () => {
    expect(pickFallbackThread([])).toBeNull();
  });
});
