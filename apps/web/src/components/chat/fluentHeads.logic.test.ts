import { describe, expect, it } from "vite-plus/test";
import { deriveMessagesTimelineRows } from "./MessagesTimeline.logic";

describe("Fluent head flags", () => {
  const entry = (id: string, role: "user" | "assistant", second: number) => {
    const at = `2026-01-01T00:00:${String(second).padStart(2, "0")}Z`;
    return {
      id,
      kind: "message",
      createdAt: at,
      message: {
        id: id as never,
        role,
        text: id,
        turnId: null,
        createdAt: at,
        updatedAt: at,
        streaming: false,
      },
    } as const;
  };

  it("heads the first assistant row after a user row, and details only the latest", () => {
    const rows = deriveMessagesTimelineRows({
      timelineEntries: [
        entry("u1", "user", 1),
        entry("a1", "assistant", 2),
        entry("a1b", "assistant", 3),
        entry("u2", "user", 4),
        entry("a2", "assistant", 5),
        entry("a2b", "assistant", 6),
      ],
      isWorking: false,
      activeTurnStartedAt: null,
      turnDiffSummaries: [],
      supportsConversationRollback: false,
    });
    const flags = rows.flatMap((row) =>
      row.kind === "message" ? [[row.id, row.showHead, row.showHeadDetail]] : [],
    );
    expect(flags).toEqual([
      ["u1", true, false],
      ["a1", true, false],
      ["a1b", false, false],
      ["u2", true, false],
      ["a2", true, true],
      ["a2b", false, false],
    ]);
  });
});
