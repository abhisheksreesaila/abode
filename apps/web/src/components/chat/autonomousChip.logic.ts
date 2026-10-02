import type { RuntimeMode, ThreadAutonomousState } from "@t3tools/contracts";

export interface AutonomousChipView {
  readonly on: boolean;
  /** "Autonomous" when off, "auto 3/30" while it is running turns on its own. */
  readonly label: string;
  /** Tooltip body: what a click does, why it last stopped, and the access warning. */
  readonly tooltip: string;
}

const STOP_REASON_TEXT = {
  done: "Finished: the agent signalled it is done.",
  cap: "Stopped at the auto-continue cap.",
  error: "Stopped: the last turn failed.",
  interrupted: "Stopped: you interrupted it.",
  "rate-limited": "Stopped: a usage limit was reached.",
  "plan-awaiting-approval": "Stopped: a plan is waiting for your approval.",
} as const;

export const AUTONOMOUS_ACCESS_WARNING =
  "Works best with Full access: approval requests are left waiting for you.";

/** The composer chip's face for a thread's autonomous state (absent means off). */
export function resolveAutonomousChip(
  state: ThreadAutonomousState | null | undefined,
  runtimeMode: RuntimeMode,
): AutonomousChipView {
  const on = state?.enabled === true;
  if (!on) {
    const stopped = state?.stopReason ? ` ${STOP_REASON_TEXT[state.stopReason]}` : "";
    const detail = state?.stopDetail ? ` (${state.stopDetail})` : "";
    return {
      on: false,
      label: "Autonomous",
      tooltip: `Keep going on its own until done, up to ${state?.cap ?? 30} follow-ups.${stopped}${detail}`,
    };
  }
  const warning = runtimeMode === "full-access" ? "" : ` ${AUTONOMOUS_ACCESS_WARNING}`;
  return {
    on: true,
    label: `auto ${state.count}/${state.cap}`,
    tooltip: `Autonomous is on. Click to stop.${warning}`,
  };
}
