import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useState } from "react";

import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { newMessageId } from "~/lib/utils";
import { useThreadShell } from "~/state/entities";
import { threadEnvironment } from "~/state/threads";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";

import { ModeIcon } from "./ModeVisuals";
import { MODE_ORDER, MODES, steeringMessage, type SessionMode } from "./sessionMode";
import { useSessionModeStore } from "./sessionModeStore";
import type { SessionPill } from "./sessionPills";

/** The pill's mode icon. A tap opens the picker; a new mode is stored here and sent to the thread once. */
export function ModeButton(props: { readonly pill: SessionPill; readonly mode: SessionMode }) {
  const { pill, mode } = props;
  const [open, setOpen] = useState(false);
  const shell = useThreadShell(scopeThreadRef(pill.environmentId, pill.threadId));
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn, { reportFailure: false });

  const choose = async (next: SessionMode) => {
    setOpen(false);
    const text = steeringMessage(mode, next);
    if (text === null) return;
    useSessionModeStore.getState().setMode(pill.key, next);
    if (shell === null) return;
    const result = await startTurn({
      environmentId: pill.environmentId,
      input: {
        threadId: pill.threadId,
        message: { messageId: newMessageId(), role: "user", text, attachments: [] },
        runtimeMode: shell.runtimeMode,
        interactionMode: shell.interactionMode,
        dispatchMode: "queue",
      },
    });
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: `Mode changed here, but ${pill.title} did not get the message`,
          description: error instanceof Error ? error.message : "An error occurred.",
        }),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-cv-mbtn=""
        aria-label={`Mode: ${MODES[mode].label}. Change mode`}
        data-mode={mode}
      >
        <ModeIcon mode={mode} />
      </PopoverTrigger>
      <PopoverPopup align="start" padding="none" sideOffset={6}>
        <div data-cv-mpop="" role="group" aria-label="Session mode">
          {MODE_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              data-cv-mopt=""
              data-mode={option}
              aria-pressed={option === mode}
              onClick={() => void choose(option)}
            >
              <ModeIcon mode={option} />
              {MODES[option].label}
            </button>
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
