import { MessageId, type AssistantCitation, type ScopedThreadRef } from "@t3tools/contracts";
import { MessageCircleQuestionIcon } from "lucide-react";
import { buildAssistantMessageQuote } from "~/lib/assistantMessageQuote";
import { toastManager } from "../ui/toast";
import { Button } from "../ui/button";

/**
 * Hover action on an agent message: quotes the whole message into the composer
 * as the same removable citation chip that selecting text produces. It reads
 * the message data, not the DOM, and always reports a failure.
 */
export function AskAboutMessageButton({
  messageId,
  threadRef,
  text,
  onQuote,
}: {
  messageId: MessageId;
  threadRef: ScopedThreadRef;
  text: string;
  onQuote: (citation: AssistantCitation) => boolean;
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant="glass"
      aria-label="Ask about this message"
      onClick={() => {
        const quote = buildAssistantMessageQuote({ threadRef, messageId, text });
        if (!quote.ok) {
          toastManager.add({
            type: "warning",
            title:
              quote.reason === "empty"
                ? "There is nothing to quote in this message"
                : "This message is too long to quote whole",
            ...(quote.reason === "too-long"
              ? { description: "Select the part you want to ask about instead." }
              : {}),
          });
          return;
        }
        if (!onQuote(quote.citation)) {
          toastManager.add({
            type: "warning",
            title: "The composer is not ready",
            description: "Try again in a moment.",
          });
        }
      }}
    >
      <MessageCircleQuestionIcon aria-hidden="true" className="size-3" />
      Ask about this
    </Button>
  );
}
