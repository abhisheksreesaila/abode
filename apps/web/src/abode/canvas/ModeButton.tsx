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
import { changeMode, MODE_ORDER, MODES, type SessionMode } from "./sessionMode";
import { useSessionModeStore } from "./sessionModeStore";
import type { SessionPill } from "./sessionPills";

/** Changes a session's mode: stored here and sent to the thread once; a failed send is toasted. */
function useChooseMode(pill: SessionPill, mode: SessionMode) {
  const shell = useThreadShell(scopeThreadRef(pill.environmentId, pill.threadId));
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn, { reportFailure: false });

  return async (next: SessionMode) => {
    const error = await changeMode({
      from: mode,
      to: next,
      store: (value) => useSessionModeStore.getState().setMode(pill.key, value),
      send: async (text) => {
        if (shell === null) return new Error("The session is not loaded yet.");
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
        if (result._tag === "Success") return null;
        if (isAtomCommandInterrupted(result)) return null;
        const failure = squashAtomCommandFailure(result);
        return failure instanceof Error ? failure : new Error("An error occurred.");
      },
    });
    if (error !== null) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: `Could not change ${pill.title} to ${MODES[next].label}`,
          description: error.message,
        }),
      );
    }
  };
}

/** The pill's mode icon. A tap opens the picker. */
export function ModeButton(props: { readonly pill: SessionPill; readonly mode: SessionMode }) {
  const { pill, mode } = props;
  const [open, setOpen] = useState(false);
  const choose = useChooseMode(pill, mode);

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
              onClick={() => {
                setOpen(false);
                void choose(option);
              }}
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

/** The drawer's compact dial (spec 5.6): the four modes as icons, the active one labelled. */
export function ModeDial(props: { readonly pill: SessionPill; readonly mode: SessionMode }) {
  const { pill, mode } = props;
  const choose = useChooseMode(pill, mode);
  return (
    <div data-cvo-dial="" role="group" aria-label="Session mode">
      {MODE_ORDER.map((option) => (
        <button
          key={option}
          type="button"
          data-cvo-dopt=""
          data-mode={option}
          aria-pressed={option === mode}
          aria-label={MODES[option].label}
          onClick={() => void choose(option)}
        >
          <ModeIcon mode={option} />
          {option === mode ? MODES[option].label : null}
        </button>
      ))}
    </div>
  );
}
