import type { MessageId } from "@t3tools/contracts";

// Lets the command palette ask the active timeline to edit the most recent
// prompt, running the same path as the Edit button on the message.
const EDIT_LAST_MESSAGE_EVENT = "abode:edit-last-message";

export function requestEditLastMessage(): void {
  window.dispatchEvent(new CustomEvent(EDIT_LAST_MESSAGE_EVENT));
}

export function onEditLastMessageRequest(listener: () => void): () => void {
  window.addEventListener(EDIT_LAST_MESSAGE_EVENT, listener);
  return () => window.removeEventListener(EDIT_LAST_MESSAGE_EVENT, listener);
}

/**
 * The newest user message that can be rewound to. `revertTurnCount` is only set
 * for user messages whose turn has a checkpoint, so it doubles as "editable".
 */
export function findLastEditableMessage(
  rows: ReadonlyArray<{
    kind: string;
    message?: { id: MessageId; role: string };
    revertTurnCount?: number | undefined;
  }>,
): { messageId: MessageId; turnCount: number } | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (
      row?.kind === "message" &&
      row.message?.role === "user" &&
      typeof row.revertTurnCount === "number"
    ) {
      return { messageId: row.message.id, turnCount: row.revertTurnCount };
    }
  }
  return null;
}
