import { describe, expect, it } from "vite-plus/test";

import { buildBoard, type BoardSourceItem } from "./boardModel";

const user = (text = "hi"): BoardSourceItem => ({ type: "user_message", text });
const agent = (messageId: string, text: string, streaming = false): BoardSourceItem => ({
  type: "assistant_message",
  messageId,
  text,
  streaming,
});

describe("buildBoard", () => {
  it("files cards into lanes, newest first", () => {
    const board = buildBoard([
      agent("m1", "> [!WARNING]\n> old warning"),
      user(),
      agent("m2", "> [!WARNING]\n> new warning\n\n> [!DONE]\n> sort merged"),
    ]);
    expect(board.watchOut.map((entry) => entry.card.body)).toEqual(["new warning", "old warning"]);
    expect(board.done.map((entry) => entry.messageId)).toEqual(["m2"]);
  });

  it("keeps a question open only until the user replies", () => {
    const open = buildBoard([
      user(),
      agent("m1", "> [!QUESTION]\n> Run it now?\n> - Go\n> - Wait"),
    ]);
    expect(open.needsYou.map((entry) => entry.card.options)).toEqual([["Go", "Wait"]]);

    const answered = buildBoard([user(), agent("m1", "Run it now?"), user("go")]);
    expect(answered.needsYou).toEqual([]);
  });

  it("only asks the latest answer's questions", () => {
    const board = buildBoard([agent("m1", "Shall I?"), agent("m2", "Done with it. Ready?")]);
    expect(board.needsYou.map((entry) => entry.messageId)).toEqual(["m2"]);
  });

  it("waits for a streaming answer to finish before asking", () => {
    expect(buildBoard([agent("m1", "Should I go on?", true)]).needsYou).toEqual([]);
  });

  it("lists each ticket once, from its newest mention", () => {
    const board = buildBoard([
      agent("m1", "> [!TICKETS]\n> - F-022 precision\n> - F-014 kernels"),
      agent("m2", "> [!TICKETS]\n> - F-022 precision bug, now first"),
    ]);
    expect(
      board.tickets.map((entry) => [entry.ticket.id, entry.ticket.title, entry.messageId]),
    ).toEqual([
      ["F-022", "precision bug, now first", "m2"],
      ["F-014", "kernels", "m1"],
    ]);
  });

  it("is empty for a thread without cards", () => {
    expect(buildBoard([user(), agent("m1", "All green.")])).toMatchObject({
      needsYou: [],
      watchOut: [],
      tickets: [],
      done: [],
      isEmpty: true,
    });
  });
});
