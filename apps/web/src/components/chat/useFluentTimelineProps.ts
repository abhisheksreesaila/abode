import type { ModelSelection, RuntimeMode, UserInputQuestion } from "@t3tools/contracts";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { getChosenAgent } from "./composerAgent";
import { formatAgentDetail, resolveAgentName, type MessageIdentity } from "./messageAvatar.logic";
import { derivePendingAsk, type PendingAsk } from "./pendingAsk.logic";
import { getTriggerDisplayModelName } from "./providerIconUtils";
import { runtimeModeConfig } from "./runtimeModeConfig";

type ProviderModel = Parameters<typeof getTriggerDisplayModelName>[0] & { readonly slug: string };

// Same delay the composer panel uses between selecting an option and advancing,
// so the select has landed in the shared answer state before the advance reads it.
const ADVANCE_DELAY_MS = 200;

/**
 * The extra props the Fluent transcript hands MessagesTimeline: who the agent
 * is, and the active pending question as an inline ask block. The ask block
 * has no state of its own. It calls the composer panel's own select and
 * advance callbacks, so the answer path is the one that already exists.
 */
export function useFluentTimelineProps(input: {
  modelSelection: ModelSelection | undefined;
  providerModels: ReadonlyArray<ProviderModel> | undefined;
  runtimeMode: RuntimeMode;
  pendingRequestId: string | null;
  activeQuestion: UserInputQuestion | null | undefined;
  responding: boolean;
  onSelectOption: (questionId: string, optionValue: string) => void;
  onAdvance: () => void;
}): {
  messageIdentity: MessageIdentity;
  pendingAsk: PendingAsk | null;
  onAnswerPendingAsk: (questionId: string, optionValue: string) => void;
} {
  const { modelSelection, providerModels, runtimeMode, pendingRequestId, activeQuestion } = input;
  const messageIdentity = useMemo<MessageIdentity>(() => {
    const model = modelSelection
      ? providerModels?.find((candidate) => candidate.slug === modelSelection.model)
      : undefined;
    return {
      agentName: resolveAgentName(getChosenAgent(modelSelection?.options)),
      agentDetail: formatAgentDetail(
        model ? getTriggerDisplayModelName(model) : modelSelection?.model,
        runtimeModeConfig[runtimeMode].label.toLowerCase(),
      ),
    };
  }, [modelSelection, providerModels, runtimeMode]);

  const pendingAsk = useMemo(
    () =>
      pendingRequestId
        ? derivePendingAsk(pendingRequestId, activeQuestion, input.responding)
        : null,
    [pendingRequestId, activeQuestion, input.responding],
  );

  const selectRef = useRef(input.onSelectOption);
  const advanceRef = useRef(input.onAdvance);
  useEffect(() => {
    selectRef.current = input.onSelectOption;
    advanceRef.current = input.onAdvance;
  });
  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );
  const onAnswerPendingAsk = useCallback((questionId: string, optionValue: string) => {
    selectRef.current(questionId, optionValue);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      advanceRef.current();
    }, ADVANCE_DELAY_MS);
  }, []);

  return { messageIdentity, pendingAsk, onAnswerPendingAsk };
}
