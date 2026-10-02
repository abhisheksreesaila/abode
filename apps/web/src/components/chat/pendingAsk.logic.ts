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
    /** Muted line under the button; empty when the option has none or it repeats the label. */
    readonly description: string;
    readonly primary: boolean;
  }>;
  readonly responding: boolean;
  readonly dismissible: boolean;
  /** Zero-based position and total, for the "n/m" counter when there is more than one question. */
  readonly questionIndex: number;
  readonly questionCount: number;
}

/**
 * Only single-select questions become buttons: picking one answers, the same
 * as the composer panel's auto-advance. Multi-select stays in the composer.
 */
export function optionDescription(label: string, description: string | undefined): string {
  const text = description?.trim() ?? "";
  return text === label.trim() ? "" : text;
}

export function isInlineAskQuestion(question: {
  multiSelect?: boolean | undefined;
  options: ReadonlyArray<unknown>;
}): boolean {
  return !question.multiSelect && question.options.length > 0;
}

export function derivePendingAsk(
  requestId: string,
  question: UserInputQuestion | null | undefined,
  responding: boolean,
  meta: { dismissible: boolean; questionIndex: number; questionCount: number } = {
    dismissible: false,
    questionIndex: 0,
    questionCount: 1,
  },
): PendingAsk | null {
  if (!question || !isInlineAskQuestion(question)) return null;
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
      description: optionDescription(option.label, option.description),
      primary: index === primaryIndex,
    })),
    responding,
    ...meta,
  };
}

/** Key that names which question is on screen, so a delayed advance can tell it moved on. */
export function pendingAskKey(
  requestId: string | null,
  questionId: string | undefined,
): string | null {
  return requestId && questionId ? `${requestId}/${questionId}` : null;
}

/** Advance only when the answered question is still the active one. */
export function shouldAdvanceAfterAnswer(
  answeredKey: string | null,
  activeKey: string | null,
): boolean {
  return answeredKey !== null && answeredKey === activeKey;
}

export function pendingAskEqual(a: PendingAsk, b: PendingAsk): boolean {
  return (
    a.requestId === b.requestId &&
    a.questionId === b.questionId &&
    a.responding === b.responding &&
    a.dismissible === b.dismissible &&
    a.questionIndex === b.questionIndex &&
    a.questionCount === b.questionCount &&
    a.question === b.question &&
    a.options.length === b.options.length &&
    a.options.every(
      (option, i) =>
        option.value === b.options[i]!.value &&
        option.description === b.options[i]!.description &&
        option.primary === b.options[i]!.primary,
    )
  );
}

/**
 * The option a number key picks, by the composer panel's own rules: plain 1-9,
 * not while typing in an input, textarea or contenteditable.
 */
export function askOptionForKey(
  ask: PendingAsk,
  event: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean },
  typingTarget: boolean,
): string | null {
  if (ask.responding || typingTarget) return null;
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  const digit = Number.parseInt(event.key, 10);
  if (Number.isNaN(digit) || digit < 1 || digit > 9) return null;
  return ask.options[digit - 1]?.value ?? null;
}
