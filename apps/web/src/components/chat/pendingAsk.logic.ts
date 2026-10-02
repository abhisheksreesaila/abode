import type { UserInputQuestion } from "@t3tools/contracts";

/** The inline amber ask block for the active pending question. */
export interface PendingAsk {
  readonly requestId: string;
  readonly questionId: string;
  readonly header: string;
  readonly question: string;
  readonly options: ReadonlyArray<{
    readonly value: string;
    readonly label: string;
    readonly primary: boolean;
  }>;
  readonly responding: boolean;
}

/**
 * Only single-select questions become buttons: picking one answers, the same
 * as the composer panel's auto-advance. Multi-select stays in the composer.
 */
export function derivePendingAsk(
  requestId: string,
  question: UserInputQuestion | null | undefined,
  responding: boolean,
): PendingAsk | null {
  if (!question || question.multiSelect || question.options.length === 0) return null;
  const recommended = question.options.findIndex((option) => /recommended/i.test(option.label));
  const primaryIndex = recommended >= 0 ? recommended : 0;
  return {
    requestId,
    questionId: question.id,
    header: question.header,
    question: question.question,
    options: question.options.map((option, index) => ({
      value: option.value ?? option.label,
      label: option.label,
      primary: index === primaryIndex,
    })),
    responding,
  };
}

export function pendingAskEqual(a: PendingAsk, b: PendingAsk): boolean {
  return (
    a.requestId === b.requestId &&
    a.questionId === b.questionId &&
    a.responding === b.responding &&
    a.question === b.question &&
    a.options.length === b.options.length &&
    a.options.every(
      (option, i) =>
        option.value === b.options[i]!.value && option.primary === b.options[i]!.primary,
    )
  );
}
