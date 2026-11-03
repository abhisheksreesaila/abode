import { describe, expect, it } from "vite-plus/test";

import {
  briefLines,
  composeBlocks,
  composeSessions,
  routedSession,
  statusSentence,
  type ComposeSession,
} from "./composeBlocks";

describe("briefLines", () => {
  it("keeps the first two non-empty lines and drops markdown markers", () => {
    expect(briefLines("\n## Done\n\n- Moved the rail colours\n- Third line")).toEqual([
      "Done",
      "Moved the rail colours",
    ]);
    expect(briefLines("   ")).toEqual([]);
    expect(briefLines("x".repeat(200))[0]).toBe(`${"x".repeat(157)}...`);
  });
});

describe("composeSessions", () => {
  it("reads each pill's mode from the store, defaulting to autopilot", () => {
    const pill = (key: string) =>
      ({ key, pending: null, status: "blocked" }) as unknown as Parameters<
        typeof composeSessions
      >[0][number];
    expect(composeSessions([pill("a"), pill("b")], { b: "jam" })).toEqual([
      { key: "a", mode: "auto", pending: null, status: "blocked" },
      { key: "b", mode: "jam", pending: null, status: "blocked" },
    ]);
  });
});

const session = (key: string, overrides: Partial<ComposeSession> = {}): ComposeSession => ({
  key,
  mode: "auto",
  pending: null,
  status: null,
  ...overrides,
});

describe("composeBlocks", () => {
  it("falls back to status and plan with no sessions", () => {
    expect(composeBlocks([])).toEqual([[{ block: "status" }], [{ block: "plan" }]]);
  });

  it("shows a made line beside the plan when an Autopilot session exists", () => {
    expect(composeBlocks([session("a")])).toEqual([
      [{ block: "status" }],
      [{ block: "plan" }, { block: "side", items: [{ block: "made" }] }],
    ]);
  });

  it("adds grill and answers per Grill me session, and a jam intro with a chat stub per Jam", () => {
    const rows = composeBlocks([
      session("g1", { mode: "grill" }),
      session("j1", { mode: "jam" }),
      session("g2", { mode: "grill" }),
    ]);
    expect(rows).toEqual([
      [{ block: "status" }],
      [
        { block: "grill", sessionKey: "g1" },
        { block: "answers", sessionKey: "g1" },
      ],
      [
        { block: "grill", sessionKey: "g2" },
        { block: "answers", sessionKey: "g2" },
      ],
      [
        { block: "jamintro", sessionKey: "j1" },
        { block: "chat", sessionKey: "j1" },
      ],
      [{ block: "plan" }],
    ]);
  });

  it("puts one brief per Tell me session beside the plan, before the made line", () => {
    expect(
      composeBlocks([
        session("t1", { mode: "tell" }),
        session("a"),
        session("t2", { mode: "tell" }),
      ]),
    ).toEqual([
      [{ block: "status" }],
      [
        { block: "plan" },
        {
          block: "side",
          items: [
            { block: "sbrief", sessionKey: "t1" },
            { block: "sbrief", sessionKey: "t2" },
            { block: "made" },
          ],
        },
      ],
    ]);
  });

  it("raises an interrupt for a pending approval in any mode, right after the status", () => {
    const rows = composeBlocks([
      session("j1", { mode: "jam", pending: "approval" }),
      session("a", { pending: "input" }),
    ]);
    expect(rows.slice(0, 3)).toEqual([
      [{ block: "status" }],
      [{ block: "interrupt", sessionKey: "j1" }],
      [{ block: "interrupt", sessionKey: "a" }],
    ]);
  });

  it("leaves a Grill me session's own question to its grill card, but not its approvals", () => {
    const question = composeBlocks([session("g", { mode: "grill", pending: "input" })]);
    expect(question.flat().some((block) => block.block === "interrupt")).toBe(false);
    const approval = composeBlocks([session("g", { mode: "grill", pending: "approval" })]);
    expect(approval[1]).toEqual([{ block: "interrupt", sessionKey: "g" }]);
  });
});

describe("statusSentence", () => {
  it("counts live, waiting and blocked sessions", () => {
    expect(statusSentence([])).toBe("No live sessions.");
    expect(statusSentence([session("a")])).toBe("1 live session.");
    expect(
      statusSentence([
        session("a", { status: "waiting on you" }),
        session("b", { status: "blocked" }),
        session("c"),
      ]),
    ).toBe("3 live sessions, 1 waiting on you, 1 blocked.");
  });
});

describe("routedSession", () => {
  it("prefers Grill me, then Jam, then a session that needs you, then the first", () => {
    const a = session("a");
    const waiting = session("w", { status: "waiting on you" });
    const jam = session("j", { mode: "jam" });
    const grill = session("g", { mode: "grill" });
    expect(routedSession([a, waiting, jam, grill])?.key).toBe("g");
    expect(routedSession([a, waiting, jam])?.key).toBe("j");
    expect(routedSession([a, waiting])?.key).toBe("w");
    expect(routedSession([a])?.key).toBe("a");
    expect(routedSession([])).toBeUndefined();
  });
});
