import { describe, expect, it } from "vite-plus/test";

import { askClaudeAction } from "./askClaude";

describe("askClaudeAction", () => {
  it("only fills the prompt on a draft, which has no thread route", () => {
    expect(askClaudeAction({ hasThreadRef: true, isDraft: true })).toEqual({ kind: "prompt" });
  });
  it("fills the prompt and opens a server thread", () => {
    expect(askClaudeAction({ hasThreadRef: true, isDraft: false })).toEqual({
      kind: "prompt-and-open",
    });
  });
  it("is disabled with a reason when there is no session", () => {
    expect(askClaudeAction({ hasThreadRef: false, isDraft: false })).toEqual({
      kind: "disabled",
      reason: "Open a session first, then ask Claude from there.",
    });
  });
});
