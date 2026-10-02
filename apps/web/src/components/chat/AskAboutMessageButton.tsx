import {
  ASSISTANT_CITATION_MAX_TEXT_LENGTH,
  MessageId,
  type AssistantCitation,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { MessageCircleQuestionIcon } from "lucide-react";
import {
  captureAssistantMessageText,
  type AssistantCitationSourceAnchor,
} from "~/lib/assistantTextSelection";
import { toastManager } from "../ui/toast";
import { Button } from "../ui/button";

/**
 * Hover action on an agent message: quotes the whole message into the composer
 * as the same removable citation chip that selecting text produces.
 */
export function AskAboutMessageButton({
  messageId,
  threadRef,
  onCite,
}: {
  messageId: MessageId;
  threadRef: ScopedThreadRef;
  onCite: (citation: AssistantCitation, sourceAnchor: AssistantCitationSourceAnchor) => boolean;
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant="ghost"
      aria-label="Ask about this message"
      onClick={(event) => {
        const viewport = event.currentTarget.closest<HTMLElement>(
          "[data-assistant-citation-viewport]",
        );
        const captured = viewport ? captureAssistantMessageText(viewport, messageId) : null;
        if (!viewport || !captured) return;
        if (captured.selector.text.length > ASSISTANT_CITATION_MAX_TEXT_LENGTH) {
          toastManager.add({
            type: "warning",
            title: "This message is too long to quote whole",
            description: "Select the part you want to ask about instead.",
          });
          return;
        }
        onCite(
          { version: 1, ...threadRef, messageId, ...captured.selector },
          { source: captured.source, range: captured.range, viewport },
        );
      }}
    >
      <MessageCircleQuestionIcon aria-hidden="true" className="size-3" />
      Ask about this
    </Button>
  );
}
