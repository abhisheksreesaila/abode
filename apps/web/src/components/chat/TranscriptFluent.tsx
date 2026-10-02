import { memo } from "react";

import { Button } from "../ui/button";
import { avatarInitials } from "./messageAvatar.logic";
import type { PendingAsk } from "./pendingAsk.logic";
import type { TurnStep } from "./turnSteps.logic";
import "./abodeTranscript.css";

// Fluent transcript pieces (F-029). Every piece is plain props in, markup out,
// with no store subscriptions, and is hidden by abodeTranscript.css unless the
// abode theme is active, so other themes keep T3's own rows.

/** 24px avatar square plus the name line: bold name, muted time and detail. */
export const MessageHead = memo(function MessageHead(props: {
  name: string;
  detail: string | null;
  time: string;
  agent: boolean;
}) {
  const { name, detail, time, agent } = props;
  return (
    <div data-fluent="msg-head" aria-hidden>
      <span data-fluent="avatar" data-agent={agent ? "" : undefined}>
        {avatarInitials(name)}
      </span>
      <span data-fluent="msg-name">{name}</span>
      <span data-fluent="msg-detail">{[time, detail].filter(Boolean).join(" · ")}</span>
    </div>
  );
});

const STEP_MARK = { done: "✓", running: "◐", failed: "✕" } as const;
const MAX_VISIBLE_STEPS = 8;

/** The Simple-mode turn summary: one 22px row per tool step. */
export const TurnStepsList = memo(function TurnStepsList(props: {
  steps: ReadonlyArray<TurnStep>;
}) {
  const visible = props.steps.slice(-MAX_VISIBLE_STEPS);
  const hidden = props.steps.length - visible.length;
  return (
    <ul data-fluent="steps" aria-label="Steps">
      {hidden > 0 ? <li data-fluent="step-more">+{hidden} earlier steps</li> : null}
      {visible.map((step) => (
        <li key={step.id} data-fluent="step" data-status={step.status}>
          <span data-fluent="step-mark" aria-hidden>
            {STEP_MARK[step.status]}
          </span>
          <span data-fluent="step-text">
            {step.parts.map((part) =>
              part.code ? (
                <code key={`c:${part.text}`}>{part.text}</code>
              ) : (
                <span key={`t:${part.text}`}>{part.text}</span>
              ),
            )}
          </span>
        </li>
      ))}
    </ul>
  );
});

/**
 * The pending question as an amber block with one button per option. It only
 * calls `onAnswer`; the answer state lives where the composer panel keeps it.
 */
export const PendingAskBlock = memo(function PendingAskBlock(props: {
  ask: PendingAsk;
  onAnswer: (questionId: string, optionValue: string) => void;
}) {
  const { ask, onAnswer } = props;
  return (
    <div data-fluent="ask" role="group" aria-label={ask.header} data-pending-ask="">
      <p data-fluent="ask-text">{ask.question}</p>
      <div data-fluent="ask-actions">
        {ask.options.map((option) => (
          <Button
            key={option.value}
            size="compact"
            variant={option.primary ? "default" : "outline"}
            disabled={ask.responding}
            onClick={() => onAnswer(ask.questionId, option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
});
