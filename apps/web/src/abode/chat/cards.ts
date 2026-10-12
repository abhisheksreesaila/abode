/**
 * Cards: the parts of an agent's answer that need the user's eye. Agents tag them as
 * `> [!KIND]` callouts (GitHub alert syntax); an untagged answer gets a best guess.
 * A wrong guess is harmless: the chat still shows the full text.
 */

export type CardKind = "question" | "warning" | "info" | "tickets" | "done";

export interface Ticket {
  readonly id: string;
  readonly title: string;
}

export interface Card {
  readonly kind: CardKind;
  readonly title: string | null;
  /** The card's text, without answer options or ticket items. */
  readonly body: string;
  readonly source: "tag" | "guess";
  /** Answer buttons for a question. */
  readonly options: ReadonlyArray<string>;
  readonly tickets: ReadonlyArray<Ticket>;
}

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

const CALLOUT_HEAD = /^\[!([A-Za-z]+)\][ \t]*(.*)$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
const TICKET_ITEM = /^\*{0,2}([A-Z][A-Z0-9]{0,5}-\d{1,5})\*{0,2}[:.)\s-]*\s*(.*)$/;

/** The kind a callout tag names, or null for an ordinary blockquote. */
export function calloutKind(tag: string): CardKind | null {
  return KIND_BY_TAG[tag.toUpperCase()] ?? null;
}

/** Blank out fenced code so nothing inside it is read as a callout or a question. */
function withoutCode(markdown: string): string[] {
  let fenced = false;
  return markdown.split(/\r?\n/).map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return "";
    }
    return fenced ? "" : line;
  });
}

function ticketFrom(text: string): Ticket | null {
  const match = TICKET_ITEM.exec(text.trim());
  return match ? { id: match[1]!, title: match[2]!.trim() } : null;
}

/** A callout's lines (without `> `) become a card: list items turn into options or tickets. */
export function cardFromCallout(kind: CardKind, title: string, lines: ReadonlyArray<string>): Card {
  const body: string[] = [];
  const items: string[] = [];
  for (const line of lines) {
    const item = LIST_ITEM.exec(line);
    if (item && (kind === "question" || kind === "tickets")) items.push(item[1]!.trim());
    else body.push(line);
  }
  const tickets =
    kind === "tickets" ? items.map(ticketFrom).filter((t): t is Ticket => t !== null) : [];
  return {
    kind,
    title: title.trim() || null,
    body: body.join("\n").trim(),
    source: "tag",
    options: kind === "question" ? items : [],
    tickets,
  };
}

function taggedCards(lines: ReadonlyArray<string>): Card[] {
  const cards: Card[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const quote = /^\s*>\s?(.*)$/.exec(lines[index]!);
    const head = quote ? CALLOUT_HEAD.exec(quote[1]!.trim()) : null;
    const kind = head ? calloutKind(head[1]!) : null;
    if (!head || !kind) continue;
    const body: string[] = [];
    while (index + 1 < lines.length && /^\s*>/.test(lines[index + 1]!)) {
      index += 1;
      body.push(lines[index]!.replace(/^\s*>\s?/, ""));
    }
    cards.push(cardFromCallout(kind, head[2]!, body));
  }
  return cards;
}

function guessed(kind: CardKind, body: string, tickets: ReadonlyArray<Ticket> = []): Card {
  return { kind, title: null, body, source: "guess", options: [], tickets };
}

const WARNING_START = /^(?:\*\*|__)?(?:warning|caution|heads up|careful|watch out|⚠️?)\b/i;

function guessedCards(lines: ReadonlyArray<string>): Card[] {
  const paragraphs = lines
    .join("\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const cards: Card[] = [];
  for (const paragraph of paragraphs) {
    if (WARNING_START.test(paragraph)) cards.push(guessed("warning", paragraph));
    const items = paragraph
      .split("\n")
      .map((line) => LIST_ITEM.exec(line)?.[1])
      .filter((item): item is string => item !== undefined);
    const tickets = items.map(ticketFrom).filter((t): t is Ticket => t !== null);
    if (tickets.length >= 2) cards.push(guessed("tickets", paragraph, tickets));
  }
  // Only a question that closes the answer is one for the user.
  const last = paragraphs.at(-1);
  if (last && last.endsWith("?") && !LIST_ITEM.test(last)) {
    const sentences = last.split(/(?<=[.!?])\s+/);
    cards.push(guessed("question", sentences.at(-1)!.trim()));
  }
  return cards;
}

/** The cards in one assistant message: its tags, or a guess when it has none. */
export function parseCards(markdown: string): Card[] {
  const lines = withoutCode(markdown);
  const tagged = taggedCards(lines);
  return tagged.length > 0 ? tagged : guessedCards(lines);
}
