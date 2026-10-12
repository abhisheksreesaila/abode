import { describe, expect, it } from "vite-plus/test";

import { parseCards } from "./cards";

describe("tagged cards", () => {
  it("reads each callout kind with its body", () => {
    const cards = parseCards(
      [
        "Intro text.",
        "",
        "> [!WARNING]",
        "> Q21 is 2.3x slower than Polars.",
        "",
        "> [!DONE] Shipped",
        "> Faster CPU sort merged.",
      ].join("\n"),
    );
    expect(cards.map((card) => [card.kind, card.title, card.body, card.source])).toEqual([
      ["warning", null, "Q21 is 2.3x slower than Polars.", "tag"],
      ["done", "Shipped", "Faster CPU sort merged.", "tag"],
    ]);
  });

  it("turns list items in a question into answer options", () => {
    const [card] = parseCards(
      ["> [!QUESTION]", "> Can I run the full benchmark now?", "> - Go now", "> - Tonight"].join(
        "\n",
      ),
    );
    expect(card).toMatchObject({
      kind: "question",
      body: "Can I run the full benchmark now?",
      options: ["Go now", "Tonight"],
    });
  });

  it("pulls ticket ids out of a tickets card", () => {
    const [card] = parseCards(
      ["> [!TICKETS]", "> - F-022 GPU fallback precision", "> - F-014: fast kernels"].join("\n"),
    );
    expect(card?.tickets).toEqual([
      { id: "F-022", title: "GPU fallback precision" },
      { id: "F-014", title: "fast kernels" },
    ]);
  });

  it("maps GitHub alert names onto abode kinds", () => {
    const kinds = parseCards(
      ["> [!NOTE]", "> a", "", "> [!CAUTION]", "> b", "", "> [!TIP]", "> c"].join("\n"),
    ).map((card) => card.kind);
    expect(kinds).toEqual(["info", "warning", "info"]);
  });

  it("ignores callout syntax inside code fences", () => {
    expect(parseCards(["```md", "> [!WARNING]", "> not real", "```"].join("\n"))).toEqual([]);
  });
});

describe("guessed cards (no tags in the message)", () => {
  it("finds a closing question addressed to the user", () => {
    const cards = parseCards(
      "I fixed the sort.\n\nThe benchmark takes 40 minutes. Should I run it now?",
    );
    expect(cards).toEqual([
      expect.objectContaining({
        kind: "question",
        body: "Should I run it now?",
        source: "guess",
      }),
    ]);
  });

  it("does not treat a question in the middle of the answer as one for the user", () => {
    expect(
      parseCards("Why was it slow? The join spilled to disk.\n\nI moved it to memory. All green."),
    ).toEqual([]);
  });

  it("finds warning paragraphs and ticket lists", () => {
    const cards = parseCards(
      [
        "**Warning:** GPU sums drift from CPU.",
        "",
        "Next:",
        "1. F-022 GPU fallback precision",
        "2. F-014 fast kernels",
      ].join("\n"),
    );
    expect(cards.map((card) => card.kind)).toEqual(["warning", "tickets"]);
    expect(cards[1]?.tickets?.map((ticket) => ticket.id)).toEqual(["F-022", "F-014"]);
  });

  it("does not guess when the message has tags", () => {
    const cards = parseCards("> [!INFO]\n> fyi\n\nShall I go on?");
    expect(cards.map((card) => card.kind)).toEqual(["info"]);
  });
});
