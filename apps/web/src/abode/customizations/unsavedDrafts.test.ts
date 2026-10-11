import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  clearUnsavedDraft,
  hasUnsavedDrafts,
  readUnsavedDraft,
  rememberUnsavedDraft,
} from "./unsavedDrafts";

const key = { environmentId: "env-1", path: "/w/.claude/skills/a/SKILL.md" };

beforeEach(() => clearUnsavedDraft(key));

describe("unsaved drafts", () => {
  it("restores what was typed when the side panel tab comes back", () => {
    rememberUnsavedDraft(key, { saved: "old", contents: "new" });
    expect(readUnsavedDraft(key)).toEqual({ saved: "old", contents: "new" });
  });

  it("keeps drafts apart per environment and file", () => {
    rememberUnsavedDraft(key, { saved: "a", contents: "b" });
    expect(readUnsavedDraft({ ...key, environmentId: "env-2" })).toBeNull();
    expect(readUnsavedDraft({ ...key, path: "/other" })).toBeNull();
  });

  it("forgets a draft that matches the saved text", () => {
    rememberUnsavedDraft(key, { saved: "a", contents: "b" });
    rememberUnsavedDraft(key, { saved: "b", contents: "b" });
    expect(readUnsavedDraft(key)).toBeNull();
  });

  it("can be cleared explicitly", () => {
    rememberUnsavedDraft(key, { saved: "a", contents: "b" });
    clearUnsavedDraft(key);
    expect(readUnsavedDraft(key)).toBeNull();
  });
});

describe("hasUnsavedDrafts", () => {
  it("is true only while some draft differs from disk, so a reload can warn", () => {
    expect(hasUnsavedDrafts()).toBe(false);
    rememberUnsavedDraft(key, { saved: "a", contents: "b" });
    expect(hasUnsavedDrafts()).toBe(true);
    clearUnsavedDraft(key);
    expect(hasUnsavedDrafts()).toBe(false);
  });
});
