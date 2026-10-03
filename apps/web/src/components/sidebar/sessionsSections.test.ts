import { describe, expect, it } from "vite-plus/test";

import {
  chatsProjectsFirst,
  formatSessionMeta,
  groupSessionSections,
  sumCheckpointDiff,
} from "./sessionsSections";

const thread = (
  id: string,
  extra: Partial<Parameters<typeof groupSessionSections>[0][number]> = {},
) => ({ id, archivedAt: null, updatedAt: "2026-10-01T00:00:00Z", ...extra });

describe("groupSessionSections", () => {
  it("puts autonomous threads under Automations and pinned ones under Pinned", () => {
    const sections = groupSessionSections([
      thread("a", { autonomous: { enabled: true } }),
      thread("p", { pinnedAt: "2026-10-01T00:00:00Z" }),
      thread("plain"),
      thread("off", { autonomous: { enabled: false } }),
    ]);
    expect(sections.automations.map((t) => t.id)).toEqual(["a"]);
    expect(sections.pinned.map((t) => t.id)).toEqual(["p"]);
  });

  it("lists a pinned autonomous thread once, under Automations", () => {
    const sections = groupSessionSections([
      thread("both", { autonomous: { enabled: true }, pinnedAt: "2026-10-01T00:00:00Z" }),
    ]);
    expect(sections.automations).toHaveLength(1);
    expect(sections.pinned).toHaveLength(0);
  });

  it("hides archived threads and returns empty sections for none", () => {
    const sections = groupSessionSections([
      thread("x", { archivedAt: "2026-10-01T00:00:00Z", pinnedAt: "2026-10-01T00:00:00Z" }),
    ]);
    expect(sections).toEqual({ automations: [], pinned: [] });
  });

  it("orders Pinned by the user's pin order, then newest pin", () => {
    const sections = groupSessionSections([
      thread("b", { pinnedAt: "2026-10-01T00:00:00Z", pinOrderKey: "b" }),
      thread("a", { pinnedAt: "2026-09-01T00:00:00Z", pinOrderKey: "a" }),
      thread("n1", { pinnedAt: "2026-08-01T00:00:00Z" }),
      thread("n2", { pinnedAt: "2026-08-02T00:00:00Z" }),
    ]);
    const ids = sections.pinned.map((t) => t.id);
    expect(ids.indexOf("a")).toBeLessThan(ids.indexOf("b"));
    expect(ids.indexOf("n2")).toBeLessThan(ids.indexOf("n1"));
  });
});

describe("chatsProjectsFirst", () => {
  it("moves Chats to the top and keeps the rest in order", () => {
    const projects = ["x", "chats", "y"];
    expect(chatsProjectsFirst(projects, (p) => p === "chats")).toEqual(["chats", "x", "y"]);
  });
  it("returns the same list when there are no chats", () => {
    const projects = ["x", "y"];
    expect(chatsProjectsFirst(projects, () => false)).toBe(projects);
  });
});

describe("sumCheckpointDiff", () => {
  it("adds up ready checkpoints only", () => {
    expect(
      sumCheckpointDiff([
        { status: "ready", files: [{ additions: 3, deletions: 1 }] },
        { status: "ready", files: [{ additions: 2, deletions: 0 }] },
        { status: "error", files: [{ additions: 100, deletions: 100 }] },
      ]),
    ).toEqual({ additions: 5, deletions: 1 });
  });
  it("is null when nothing changed", () => {
    expect(sumCheckpointDiff([])).toBeNull();
    expect(sumCheckpointDiff([{ status: "ready", files: [] }])).toBeNull();
  });
});

describe("formatSessionMeta", () => {
  it("shows just the time inside a project folder", () => {
    expect(formatSessionMeta({ diff: null, relativeTime: "4 mins ago" })).toEqual({
      diff: null,
      label: "4 mins ago",
    });
  });
  it("leads with the project where the row sits outside its folder", () => {
    expect(
      formatSessionMeta({ diff: null, relativeTime: "6 days ago", projectName: "mxstudio" }).label,
    ).toBe("mxstudio · 6 days ago");
  });
  it("carries the diff so the row can colour it", () => {
    const meta = formatSessionMeta({
      diff: { additions: 39157, deletions: 2453 },
      relativeTime: "4 days ago",
    });
    expect(meta.diff).toEqual({ additions: 39157, deletions: 2453 });
  });
  it("drops an empty time", () => {
    expect(formatSessionMeta({ diff: null, relativeTime: "", projectName: "p" }).label).toBe("p");
  });
});
