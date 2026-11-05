import { describe, expect, it } from "vite-plus/test";

import { groupRailItems, workspaceGroup, workspaceInitials } from "./railGroups";

const idle = { attention: null, failed: false } as const;
const running = { attention: "running", failed: false } as const;
const waiting = { attention: "needs-you", failed: false } as const;
const failed = { attention: null, failed: true } as const;
const done = { attention: "done", failed: false } as const;

describe("workspaceGroup", () => {
  it("is quiet with no sessions or only idle and finished ones", () => {
    expect(workspaceGroup([])).toBe("quiet");
    expect(workspaceGroup([idle, done])).toBe("quiet");
  });

  it("is move when something runs", () => {
    expect(workspaceGroup([idle, running])).toBe("move");
  });

  it("is need when a session waits on the user or is blocked, even if another runs", () => {
    expect(workspaceGroup([running, waiting])).toBe("need");
    expect(workspaceGroup([idle, failed])).toBe("need");
  });
});

describe("groupRailItems", () => {
  it("orders need, move, quiet and keeps the given order inside a group", () => {
    const items = [
      { key: "a", group: "quiet" },
      { key: "b", group: "move" },
      { key: "c", group: "need" },
      { key: "d", group: "quiet" },
      { key: "e", group: "need" },
    ] as const;
    expect(groupRailItems(items).map((item) => item.key)).toEqual(["c", "e", "b", "a", "d"]);
  });
});

describe("workspaceInitials", () => {
  it("takes two word initials, or the first two letters of one word", () => {
    expect(workspaceInitials("abode next")).toBe("An");
    expect(workspaceInitials("ablearn")).toBe("Ab");
    expect(workspaceInitials("my-cool-app")).toBe("Mc");
    expect(workspaceInitials("")).toBe("?");
  });
});
