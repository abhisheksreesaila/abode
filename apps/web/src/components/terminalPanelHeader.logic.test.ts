import { describe, expect, it } from "vite-plus/test";

import { formatTerminalPanelContext } from "./terminalPanelHeader.logic";

describe("formatTerminalPanelContext", () => {
  it("joins the terminal label and the folder", () => {
    expect(formatTerminalPanelContext({ label: "Terminal 1", cwd: "/home/me/abode" })).toBe(
      "Terminal 1 · abode",
    );
  });

  it("prefers the worktree folder", () => {
    expect(
      formatTerminalPanelContext({
        label: "zsh",
        cwd: "/home/me/abode",
        worktreePath: "/home/me/abode/.claude/worktrees/x/",
      }),
    ).toBe("zsh · x");
  });

  it("handles windows paths and a missing label", () => {
    expect(formatTerminalPanelContext({ label: null, cwd: "C:\\Users\\me\\abode\\" })).toBe(
      "abode",
    );
  });
});
