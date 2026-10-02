import type {
  OrchestrationMessage,
  OrchestrationSessionStatus,
  ThreadAutonomousState,
  ThreadAutonomousStopReason,
} from "@t3tools/contracts";
import {
  AUTONOMOUS_CONTINUE_PREFIX,
  endsWithAutonomousDoneMarker,
} from "@t3tools/shared/autonomous";

/** Sent as the user turn that keeps an autonomous thread going. */
export const AUTONOMOUS_NUDGE =
  "Continue working autonomously until the task is fully complete. Do not ask me for confirmation; make reasonable assumptions and proceed. Write any open questions or assumptions into docs/plan.md under the ticket. When everything is done, end your final message with ABODE:DONE.";

/** Answer for a free-text question the agent asked while running autonomously. */
export const AUTONOMOUS_ASSUME_ANSWER =
  "Make a reasonable assumption and proceed. Write the open question and your assumption into docs/plan.md under the ticket.";

/** Text of the user turn for the `count`th automatic continue. */
export function autoContinueMessageText(count: number, cap: number): string {
  return `${AUTONOMOUS_CONTINUE_PREFIX} ${count}/${cap}]\n${AUTONOMOUS_NUDGE}`;
}

export type AutoContinueDecision =
  | { readonly action: "none" }
  | { readonly action: "continue"; readonly nextCount: number }
  | {
      readonly action: "stop";
      readonly reason: ThreadAutonomousStopReason;
      readonly detail: string | null;
    };

const RATE_LIMIT_PATTERN = /rate.?limit|usage limit|too many requests|\b429\b|quota|overloaded/i;

/**
 * What an autonomous thread does when a turn ends. `none` means the turn has
 * not ended (or autonomous mode is off), so nothing changes.
 */
export function decideAutoContinue(input: {
  readonly state: ThreadAutonomousState | null | undefined;
  readonly sessionStatus: OrchestrationSessionStatus | null;
  readonly lastError: string | null;
  readonly finalAssistantText: string | null;
}): AutoContinueDecision {
  const { state, sessionStatus } = input;
  if (state?.enabled !== true) return { action: "none" };
  switch (sessionStatus) {
    case "interrupted":
      return { action: "stop", reason: "interrupted", detail: null };
    case "error": {
      const detail = input.lastError ?? "Turn failed";
      return {
        action: "stop",
        reason: RATE_LIMIT_PATTERN.test(detail) ? "rate-limited" : "error",
        detail,
      };
    }
    case "stopped":
      return { action: "stop", reason: "error", detail: "Session stopped" };
    case "ready":
    case "idle":
      break;
    default:
      return { action: "none" };
  }
  if (input.finalAssistantText !== null && endsWithAutonomousDoneMarker(input.finalAssistantText)) {
    return { action: "stop", reason: "done", detail: null };
  }
  if (state.count >= state.cap) {
    return { action: "stop", reason: "cap", detail: `Reached ${state.cap} auto-continues` };
  }
  return { action: "continue", nextCount: state.count + 1 };
}

/** The agent's last visible reply since the most recent user message. */
export function finalAssistantTextSinceLastUserMessage(
  messages: ReadonlyArray<Pick<OrchestrationMessage, "role" | "text" | "streaming">>,
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.role === "user") return null;
    if (message.role === "assistant" && !message.streaming && message.text.trim().length > 0) {
      return message.text;
    }
  }
  return null;
}
