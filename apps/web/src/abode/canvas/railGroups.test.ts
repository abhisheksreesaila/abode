import { describe, expect, it } from "vite-plus/test";

import {
  groupRailItems,
  withJam,
  workspaceGroup,
  workspaceInitials,
  workspaceMode,
} from "./railGroups";

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
  it("orders need, jam, move, quiet and keeps the given order inside a group", () => {
    const items = [
      { key: "a", group: "quiet" },
      { key: "b", group: "move" },
      { key: "c", group: "need" },
      { key: "d", group: "quiet" },
      { key: "e", group: "need" },
      { key: "f", group: "jam" },
    ] as const;
    expect(groupRailItems(items).map((item) => item.key)).toEqual(["c", "e", "f", "b", "a", "d"]);
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

describe("withJam", () => {
  it("moves a moving or quiet workspace with a Jam session into jam", () => {
    expect(withJam("move", ["auto", "jam"])).toBe("jam");
    expect(withJam("quiet", ["jam"])).toBe("jam");
  });
  it("leaves a workspace that needs you where it is", () => {
    expect(withJam("need", ["jam"])).toBe("need");
  });
  it("changes nothing without a Jam session", () => {
    expect(withJam("move", ["auto", "grill"])).toBe("move");
  });
});

describe("workspaceMode", () => {
  it("shows the most hands-on live mode", () => {
    expect(workspaceMode(["auto", "tell", "grill"])).toBe("grill");
    expect(workspaceMode(["auto", "jam", "grill"])).toBe("jam");
    expect(workspaceMode(["auto", "tell"])).toBe("tell");
  });
  it("is Autopilot with no live session", () => {
    expect(workspaceMode([])).toBe("auto");
  });
});

it("orders need, jam, move, quiet", () => {
  const items = [
    { n: "q", group: "quiet" },
    { n: "m", group: "move" },
    { n: "j", group: "jam" },
    { n: "n", group: "need" },
  ] as const;
  expect(groupRailItems(items).map((item) => item.n)).toEqual(["n", "j", "m", "q"]);
});
