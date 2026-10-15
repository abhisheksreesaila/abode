/**
 * Card kinds: the callouts agents tag as `> [!KIND]` (GitHub alert syntax) for the parts of
 * an answer that need the user's eye. The chat renders them as tinted cards.
 */

export type CardKind = "question" | "warning" | "info" | "tickets" | "done";

const KIND_BY_TAG: Record<string, CardKind> = {
  QUESTION: "question",
  ASK: "question",
  WARNING: "warning",
  CAUTION: "warning",
  IMPORTANT: "warning",
  INFO: "info",
  NOTE: "info",
  TIP: "info",
  TICKETS: "tickets",
  TODO: "tickets",
  DONE: "done",
  SUCCESS: "done",
};

/** The kind a callout tag names, or null for an ordinary blockquote. */
export function calloutKind(tag: string): CardKind | null {
  return KIND_BY_TAG[tag.toUpperCase()] ?? null;
}
