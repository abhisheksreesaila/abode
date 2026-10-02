import {
  ASSISTANT_CITATION_MAX_TEXT_LENGTH,
  type AssistantCitation,
  type MessageId,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { createAssistantTextSelector } from "./assistantTextSelection";

export type AssistantMessageQuote =
  | { ok: true; citation: AssistantCitation }
  | { ok: false; reason: "empty" | "too-long" };

/**
 * Quotes a whole agent message from its own text, with no DOM involved, so a
 * virtualized or still-streaming row cannot make the action fail silently.
 */
export function buildAssistantMessageQuote(input: {
  threadRef: ScopedThreadRef;
  messageId: MessageId;
  text: string;
}): AssistantMessageQuote {
  const selector = createAssistantTextSelector(input.text, 0, input.text.length);
  if (selector === null) return { ok: false, reason: "empty" };
  if (selector.text.length > ASSISTANT_CITATION_MAX_TEXT_LENGTH) {
    return { ok: false, reason: "too-long" };
  }
  return {
    ok: true,
    citation: { version: 1, ...input.threadRef, messageId: input.messageId, ...selector },
  };
}
