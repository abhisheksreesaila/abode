import { assert, describe, it } from "@effect/vitest";
import type { ThreadAutonomousState } from "@t3tools/contracts";

import {
  autoContinueMessageText,
  decideAutoContinue,
  finalAssistantTextSinceLastUserMessage,
} from "./ThreadAutonomousPolicy.ts";

const on = (overrides: Partial<ThreadAutonomousState> = {}): ThreadAutonomousState => ({
  enabled: true,
  count: 0,
  cap: 30,
  ...overrides,
});

const decide = (input: {
  state?: ThreadAutonomousState | null;
  sessionStatus?: Parameters<typeof decideAutoContinue>[0]["sessionStatus"];
  lastError?: string | null;
  finalAssistantText?: string | null;
}) =>
  decideAutoContinue({
    state: input.state === undefined ? on() : input.state,
    sessionStatus: input.sessionStatus ?? "ready",
    lastError: input.lastError ?? null,
    finalAssistantText: input.finalAssistantText ?? "Did some work.",
  });

describe("decideAutoContinue", () => {
  it("does nothing when the thread is not autonomous (older threads carry no field)", () => {
    assert.deepStrictEqual(decide({ state: null }), { action: "none" });
    assert.deepStrictEqual(decide({ state: on({ enabled: false }) }), { action: "none" });
  });

  it("nudges after a normal turn end", () => {
    assert.deepStrictEqual(decide({ state: on({ count: 2 }) }), {
      action: "continue",
      nextCount: 3,
    });
  });

  it("stops on the done marker, tolerating trailing decoration", () => {
    for (const text of ["All set. ABODE:DONE", "All set.\n\n**ABODE:DONE**\n", "ABODE:DONE."]) {
      assert.deepStrictEqual(decide({ finalAssistantText: text }), {
        action: "stop",
        reason: "done",
        detail: null,
      });
    }
  });

  it("does not stop on a marker that is only mentioned mid-text", () => {
    assert.strictEqual(
      decide({ finalAssistantText: "I will end with ABODE:DONE once tests pass." }).action,
      "continue",
    );
  });

  it("stops when the turn failed and records why", () => {
    assert.deepStrictEqual(decide({ sessionStatus: "error", lastError: "Boom" }), {
      action: "stop",
      reason: "error",
      detail: "Boom",
    });
  });

  it("calls out rate limits", () => {
    const decision = decide({ sessionStatus: "error", lastError: "429 usage limit reached" });
    assert.strictEqual(decision.action === "stop" && decision.reason, "rate-limited");
  });

  it("stops when the user interrupted", () => {
    assert.deepStrictEqual(decide({ sessionStatus: "interrupted" }), {
      action: "stop",
      reason: "interrupted",
      detail: null,
    });
  });

  it("stops at the cap", () => {
    const decision = decide({ state: on({ count: 30, cap: 30 }) });
    assert.strictEqual(decision.action === "stop" && decision.reason, "cap");
  });

  it("waits while a turn is still running", () => {
    assert.deepStrictEqual(decide({ sessionStatus: "running" }), { action: "none" });
    assert.deepStrictEqual(decide({ sessionStatus: "starting" }), { action: "none" });
  });

  it("a done marker wins over the cap", () => {
    const decision = decide({
      state: on({ count: 30 }),
      finalAssistantText: "ABODE:DONE",
    });
    assert.strictEqual(decision.action === "stop" && decision.reason, "done");
  });
});

describe("finalAssistantTextSinceLastUserMessage", () => {
  const message = (role: "user" | "assistant", text: string, streaming = false) => ({
    role,
    text,
    streaming,
  });

  it("ignores replies from before the latest user message", () => {
    assert.strictEqual(
      finalAssistantTextSinceLastUserMessage([
        message("user", "go"),
        message("assistant", "ABODE:DONE"),
        message("user", "again"),
      ]),
      null,
    );
  });

  it("returns the last finished assistant text of the turn", () => {
    assert.strictEqual(
      finalAssistantTextSinceLastUserMessage([
        message("user", "go"),
        message("assistant", "first"),
        message("assistant", "second"),
      ]),
      "second",
    );
  });
});

describe("autoContinueMessageText", () => {
  it("opens with the recognizable prefix", () => {
    assert.match(autoContinueMessageText(3, 30), /^\[abode:auto 3\/30\]\nContinue working/);
  });
});
