import type { MessageId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { findLastEditableMessage } from "./editLastMessage";

const id = (value: string) => value as MessageId;

describe("findLastEditableMessage", () => {
  it("picks the newest user message that has a checkpoint", () => {
    expect(
      findLastEditableMessage([
        { kind: "message", message: { id: id("u1"), role: "user" }, revertTurnCount: 1 },
        { kind: "message", message: { id: id("a1"), role: "assistant" } },
        { kind: "message", message: { id: id("u2"), role: "user" }, revertTurnCount: 2 },
        { kind: "message", message: { id: id("a2"), role: "assistant" } },
      ]),
    ).toEqual({ messageId: "u2", turnCount: 2 });
  });

  it("skips a newest message with no checkpoint yet", () => {
    expect(
      findLastEditableMessage([
        { kind: "message", message: { id: id("u1"), role: "user" }, revertTurnCount: 0 },
        { kind: "message", message: { id: id("u2"), role: "user" } },
      ]),
    ).toEqual({ messageId: "u1", turnCount: 0 });
  });

  it("returns null when nothing can be rewound", () => {
    expect(
      findLastEditableMessage([
        { kind: "work" },
        { kind: "message", message: { id: id("a1"), role: "assistant" }, revertTurnCount: 3 },
      ]),
    ).toBeNull();
  });
});
