import { describe, expect, it } from "vite-plus/test";
import type { UserInputQuestion } from "@t3tools/contracts";
import { derivePendingAsk } from "./pendingAsk.logic";

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
