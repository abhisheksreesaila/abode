import { parseCards, type Card, type Ticket } from "./cards";

/** The turn items the board reads; everything else in the thread is skipped. */
export type BoardSourceItem =
  | { readonly type: "user_message"; readonly text: string }
  | {
      readonly type: "assistant_message";
      readonly messageId: string;
      readonly text: string;
      readonly streaming: boolean;
    }
  | { readonly type: string };

export interface BoardEntry {
  readonly key: string;
  readonly messageId: string;
  readonly card: Card;
}

export interface BoardTicket {
  readonly key: string;
  readonly messageId: string;
  readonly ticket: Ticket;
}

export interface Board {
  /** Questions from the latest answer, while the user hasn't replied. */
  readonly needsYou: ReadonlyArray<BoardEntry>;
  readonly watchOut: ReadonlyArray<BoardEntry>;
  readonly tickets: ReadonlyArray<BoardTicket>;
  readonly done: ReadonlyArray<BoardEntry>;
  readonly isEmpty: boolean;
}

function isAssistant(
  item: BoardSourceItem,
): item is Extract<BoardSourceItem, { type: "assistant_message" }> {
  return item.type === "assistant_message" && "messageId" in item;
}

/** Every card in the thread, sorted into the board's lanes (newest first). */
export function buildBoard(items: ReadonlyArray<BoardSourceItem>): Board {
  const watchOut: BoardEntry[] = [];
  const done: BoardEntry[] = [];
  const tickets: BoardTicket[] = [];
  const seenTickets = new Set<string>();
  let needsYou: BoardEntry[] = [];
  let userSpokeLast = false;
  let latestAnswerSeen = false;

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]!;
    if (item.type === "user_message") {
      if (!latestAnswerSeen) userSpokeLast = true;
      continue;
    }
    if (!isAssistant(item)) continue;
    const cards = parseCards(item.text).map((card, cardIndex): BoardEntry => ({
      key: `${item.messageId}:${cardIndex}`,
      messageId: item.messageId,
      card,
    }));
    if (!latestAnswerSeen) {
      latestAnswerSeen = true;
      if (!userSpokeLast && !item.streaming) {
        needsYou = cards.filter((entry) => entry.card.kind === "question");
      }
    }
    for (const entry of cards) {
      if (entry.card.kind === "warning") watchOut.push(entry);
      else if (entry.card.kind === "done") done.push(entry);
      for (const ticket of entry.card.tickets) {
        if (seenTickets.has(ticket.id)) continue;
        seenTickets.add(ticket.id);
        tickets.push({ key: `${entry.key}:${ticket.id}`, messageId: entry.messageId, ticket });
      }
    }
  }
  return {
    needsYou,
    watchOut,
    tickets,
    done,
    isEmpty: needsYou.length + watchOut.length + tickets.length + done.length === 0,
  };
}
