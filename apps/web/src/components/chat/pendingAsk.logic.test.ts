import { describe, expect, it } from "vite-plus/test";
import type { UserInputQuestion } from "@t3tools/contracts";
import {
  askOptionForKey,
  derivePendingAsk,
  pendingAskKey,
  shouldAdvanceAfterAnswer,
} from "./pendingAsk.logic";

describe("askOptionForKey", () => {
  const key = (k: string, extra = {}) => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...extra,
  });
  const ask = () =>
    derivePendingAsk(
      "r1",
      {
        id: "q1",
        header: "H",
        question: "Q?",
        options: [
          { label: "Skip", description: "" },
          { label: "Apply", description: "", value: "apply" },
        ],
        multiSelect: false,
      } as never,
      false,
    )!;
  it("maps 1-9 to option values", () => {
    expect(askOptionForKey(ask(), key("1"), false)).toBe("Skip");
    expect(askOptionForKey(ask(), key("2"), false)).toBe("apply");
    expect(askOptionForKey(ask(), key("3"), false)).toBeNull();
    expect(askOptionForKey(ask(), key("0"), false)).toBeNull();
    expect(askOptionForKey(ask(), key("a"), false)).toBeNull();
  });
  it("ignores modifiers, typing targets and in-flight answers", () => {
    expect(askOptionForKey(ask(), key("1", { ctrlKey: true }), false)).toBeNull();
    expect(askOptionForKey(ask(), key("1"), true)).toBeNull();
    expect(askOptionForKey({ ...ask(), responding: true }, key("1"), false)).toBeNull();
  });
  it("carries dismiss and counter data", () => {
    const multi = derivePendingAsk(
      "r1",
      { id: "q", header: "H", question: "Q", options: [{ label: "A", description: "" }] } as never,
      false,
      { dismissible: true, questionIndex: 1, questionCount: 3 },
    )!;
    expect([multi.dismissible, multi.questionIndex, multi.questionCount]).toEqual([true, 1, 3]);
  });
});

describe("advance guard", () => {
  it("advances only while the answered question is still active", () => {
    const answered = pendingAskKey("r1", "q1");
    expect(shouldAdvanceAfterAnswer(answered, pendingAskKey("r1", "q1"))).toBe(true);
    expect(shouldAdvanceAfterAnswer(answered, pendingAskKey("r1", "q2"))).toBe(false);
    expect(shouldAdvanceAfterAnswer(answered, pendingAskKey("r2", "q1"))).toBe(false);
    expect(shouldAdvanceAfterAnswer(answered, pendingAskKey(null, undefined))).toBe(false);
    expect(shouldAdvanceAfterAnswer(null, null)).toBe(false);
  });
});

const question = (patch: Partial<UserInputQuestion> = {}): UserInputQuestion =>
  ({
    id: "q1",
    header: "Apply",
    question: "Apply the change?",
    options: [
      { label: "Skip", description: "" },
      { label: "Apply (Recommended)", description: "", value: "apply" },
    ],
    multiSelect: false,
    ...patch,
  }) as UserInputQuestion;

describe("derivePendingAsk", () => {
  it("makes the recommended option primary and uses option values", () => {
    const ask = derivePendingAsk("r1", question(), false)!;
    expect(ask.options.map((o) => [o.value, o.primary])).toEqual([
      ["Skip", false],
      ["apply", true],
    ]);
  });
  it("falls back to the first option as primary", () => {
    const ask = derivePendingAsk(
      "r1",
      question({
        options: [
          { label: "A", description: "" },
          { label: "B", description: "" },
        ],
      }),
      false,
    )!;
    expect(ask.options[0]!.primary).toBe(true);
  });
  it("renders nothing for multi-select, no options, or no question", () => {
    expect(derivePendingAsk("r1", question({ multiSelect: true }), false)).toBeNull();
    expect(derivePendingAsk("r1", question({ options: [] }), false)).toBeNull();
    expect(derivePendingAsk("r1", null, false)).toBeNull();
  });
});
