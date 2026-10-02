import type { ModelSelection, RuntimeMode, UserInputQuestion } from "@t3tools/contracts";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { getChosenAgent } from "./composerAgent";
import { formatAgentDetail, resolveAgentName, type MessageIdentity } from "./messageAvatar.logic";
import {
  askOptionForKey,
  derivePendingAsk,
  pendingAskKey,
  shouldAdvanceAfterAnswer,
  type PendingAsk,
} from "./pendingAsk.logic";
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
  /** The abode theme is active; otherwise there is no ask block. */
  fluent: boolean;
  dismissible: boolean;
  questionIndex: number;
  questionCount: number;
  onDismiss: (requestId: string) => void;
  onSelectOption: (questionId: string, optionValue: string) => void;
  onAdvance: () => void;
}): {
  messageIdentity: MessageIdentity;
  pendingAsk: PendingAsk | null;
  onAnswerPendingAsk: (questionId: string, optionValue: string) => void;
  onDismissPendingAsk: (requestId: string) => void;
} {
  const { modelSelection, providerModels, runtimeMode, pendingRequestId, activeQuestion } = input;
  // Memoized on the derived strings, so a provider-list refresh that changes nothing visible
  // does not hand the timeline a new identity.
  const model = modelSelection
    ? providerModels?.find((candidate) => candidate.slug === modelSelection.model)
    : undefined;
  const agentName = resolveAgentName(getChosenAgent(modelSelection?.options));
  const agentDetail = formatAgentDetail(
    model ? getTriggerDisplayModelName(model) : modelSelection?.model,
    runtimeModeConfig[runtimeMode].label.toLowerCase(),
  );
  const messageIdentity = useMemo<MessageIdentity>(
    () => ({ agentName, agentDetail }),
    [agentName, agentDetail],
  );

  const pendingAsk = useMemo(
    () =>
      input.fluent && pendingRequestId
        ? derivePendingAsk(pendingRequestId, activeQuestion, input.responding, {
            dismissible: input.dismissible,
            questionIndex: input.questionIndex,
            questionCount: input.questionCount,
          })
        : null,
    [
      input.fluent,
      pendingRequestId,
      activeQuestion,
      input.responding,
      input.dismissible,
      input.questionIndex,
      input.questionCount,
    ],
  );

  const activeKey = pendingAskKey(pendingRequestId, activeQuestion?.id);
  const activeKeyRef = useRef(activeKey);
  const selectRef = useRef(input.onSelectOption);
  const advanceRef = useRef(input.onAdvance);
  useEffect(() => {
    selectRef.current = input.onSelectOption;
    advanceRef.current = input.onAdvance;
    activeKeyRef.current = activeKey;
  });
  const pendingRequestIdRef = useRef(pendingRequestId);
  useEffect(() => {
    pendingRequestIdRef.current = pendingRequestId;
  });
  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );
  const onAnswerPendingAsk = useCallback((questionId: string, optionValue: string) => {
    const answeredKey = pendingAskKey(pendingRequestIdRef.current, questionId);
    selectRef.current(questionId, optionValue);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (shouldAdvanceAfterAnswer(answeredKey, activeKeyRef.current)) advanceRef.current();
    }, ADVANCE_DELAY_MS);
  }, []);

  // Number keys pick options, same rules as the composer panel's keys. Bound here, not in the
  // virtualized row, so scrolling the block out of view does not drop them.
  useEffect(() => {
    if (!pendingAsk) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement &&
          target.closest('[contenteditable]:not([contenteditable="false"])') !== null);
      const value = askOptionForKey(pendingAsk, event, typing);
      if (value === null) return;
      event.preventDefault();
      onAnswerPendingAsk(pendingAsk.questionId, value);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pendingAsk, onAnswerPendingAsk]);

  const dismissRef = useRef(input.onDismiss);
  useEffect(() => {
    dismissRef.current = input.onDismiss;
  });
  const onDismissPendingAsk = useCallback((requestId: string) => dismissRef.current(requestId), []);

  return { messageIdentity, pendingAsk, onAnswerPendingAsk, onDismissPendingAsk };
}
