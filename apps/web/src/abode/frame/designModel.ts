export type DesignSource = "Claude" | "Stitch" | "file";
export type DesignDevice = "desktop" | "phone";

export interface DesignMessage {
  readonly role: "user" | "assistant";
  readonly text: string;
  /** ISO time the message was sent, when known. */
  readonly at: string | null;
}

export interface DesignCard {
  /** The URL or the repo path, which is what dedupes. */
  readonly key: string;
  readonly href: string | null;
  readonly path: string | null;
  readonly source: DesignSource;
  readonly device: DesignDevice | null;
  readonly title: string;
  /** The tile's caption: the host, or the file's folder. */
  readonly host: string;
}

export interface DesignGroup {
  readonly key: string;
  /** The user message that asked for these designs. */
  readonly asked: string;
  readonly at: number | null;
  readonly cards: ReadonlyArray<DesignCard>;
}

// One pass over claude.ai artifact links, Stitch links and docs/design html paths.
// A URL stops at emphasis (`*`, `~`), brackets, angle brackets and backticks; a file path may
// be absolute (only its docs/design/... part is kept). A local preview server's URL
// (localhost, 127.0.0.1, [::1]) with docs/design in its path is the same file.
const FIND =
  /https?:\/\/(?:www\.)?claude\.ai\/(?:code\/)?artifact\/[A-Za-z0-9_-]+|https?:\/\/stitch\.(?:withgoogle|google)\.com\/[^\s)\]>"'`*~<]*|https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/(?=[^\s)\]>"'`*~<]*docs\/design\/)[^\s)\]>"'`*~<]*|(?<![\w.:/-])(?:\/?[\w.-]+\/)*docs\/design\/(?:[\w.-]+\/)*[\w.-]+\.html/g;
const TRAILING = /[.,;:!?]+$/;
const LINK_TEXT = /\[([^\]\n]{1,80})\]\(\s*<?$/;
const PHONE = /\b(?:phone|mobile|iphone|390)\b/i;
const DESKTOP = /\b(?:desktop|laptop|1440)\b/i;
const PHONE_ALL = new RegExp(PHONE.source, "gi");
const DESKTOP_ALL = new RegExp(DESKTOP.source, "gi");

function nearest(pattern: RegExp, line: string, start: number): number {
  return Math.min(
    Infinity,
    ...[...line.matchAll(pattern)].map((match) => Math.abs(match.index - start)),
  );
}

/** The device word in the match itself, else the nearest one on its line. */
function deviceNear(line: string, start: number, length: number): DesignDevice | null {
  const own = line.slice(start, start + length);
  if (PHONE.test(own)) return "phone";
  if (DESKTOP.test(own)) return "desktop";
  const phone = nearest(PHONE_ALL, line, start);
  const desktop = nearest(DESKTOP_ALL, line, start);
  if (phone === Infinity && desktop === Infinity) return null;
  return phone <= desktop ? "phone" : "desktop";
}

function cleanLabel(text: string): string {
  return text
    .replace(/[*_`#>]/g, "")
    .replace(/^[\s\-•\d.)]+/, "")
    .replace(/[\s:–—-]+$/, "")
    .trim();
}

/** A trailing `_` is part of the link unless emphasis opened with `_` right before it. */
function urlOf(raw: string, opener: string | undefined): string {
  const trimmed = raw.replace(TRAILING, "");
  return opener === "_" ? trimmed.replace(/_+$/, "") : trimmed;
}

const LOCAL_HOST = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])[:/]/;

function keyOf(raw: string, opener: string | undefined): string {
  if (!/^https?:/.test(raw)) return raw.slice(raw.lastIndexOf("docs/design/"));
  const url = urlOf(raw, opener);
  return LOCAL_HOST.test(url)
    ? url.slice(url.lastIndexOf("docs/design/")).replace(/[?#].*$/, "")
    : url;
}

/** The dedupe keys of the designs a text mentions: all the badge needs, no titles or devices. */
function designKeys(text: string): string[] {
  return [...text.matchAll(FIND)].map((match) => keyOf(match[0], text[match.index - 1]));
}

function describeMatch(text: string, index: number, raw: string): DesignCard {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  const lineEnd = text.indexOf("\n", index);
  const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const start = index - lineStart;
  const local = LOCAL_HOST.test(raw);
  const isFile = !/^https?:/.test(raw) || local;
  const key = keyOf(raw, text[index - 1]);
  const source: DesignSource = isFile ? "file" : raw.includes("claude.ai") ? "Claude" : "Stitch";
  const before = line.slice(0, start);
  const label = cleanLabel(LINK_TEXT.exec(before)?.[1] ?? before);
  const slash = key.lastIndexOf("/");
  const fallback = isFile
    ? key.slice(slash + 1)
    : source === "Claude"
      ? "Claude artifact"
      : "Stitch screen";
  return {
    key,
    href: local ? urlOf(raw, text[index - 1]) : isFile ? null : key,
    path: isFile ? key : null,
    source,
    device: deviceNear(line, start, raw.length),
    title: !isFile && label !== "" && label.length <= 60 ? label : fallback,
    host: isFile ? key.slice(0, slash) : new URL(key).host,
  };
}

/**
 * Every claude.ai artifact link, Stitch link and docs/design/**.html path in a thread's
 * messages, grouped under the user message that asked for them (the nearest one before),
 * newest group first. A link shows once, under the first message that mentioned it.
 */
export function collectDesigns(messages: ReadonlyArray<DesignMessage>): DesignGroup[] {
  const seen = new Set<string>();
  const groups: DesignGroup[] = [];
  let asker: DesignMessage | null = null;
  let askerIndex = -1;
  messages.forEach((message, messageIndex) => {
    if (message.role === "user") {
      asker = message;
      askerIndex = messageIndex;
    }
    const cards: DesignCard[] = [];
    for (const match of message.text.matchAll(FIND)) {
      const card = describeMatch(message.text, match.index, match[0]);
      if (seen.has(card.key)) continue;
      seen.add(card.key);
      cards.push(card);
    }
    if (cards.length === 0) return;
    const last = groups.at(-1);
    if (last !== undefined && last.key === `m${askerIndex}`) {
      groups[groups.length - 1] = { ...last, cards: [...last.cards, ...cards] };
      return;
    }
    const current = asker as DesignMessage | null;
    const time = current?.at == null ? Number.NaN : Date.parse(current.at);
    groups.push({
      key: `m${askerIndex}`,
      asked: current?.text.trim() ?? "",
      at: Number.isNaN(time) ? null : time,
      cards,
    });
  });
  return groups.toReversed();
}

export interface DesignPick {
  readonly title: string;
  readonly source: DesignSource;
  readonly device: DesignDevice | null;
}

export function pickPrompt(picks: ReadonlyArray<DesignPick>): string {
  const items = picks.map(
    (pick) =>
      `${pick.title} (${pick.device === null ? pick.source : `${pick.source}, ${pick.device}`})`,
  );
  return `I pick: ${items.join(", ")}`;
}

/** Cards added since the Design tab was last opened; never opened: all of them. */
export function newDesignCount(total: number, seen: number | undefined): number {
  return Math.max(0, total - (seen ?? 0));
}

const KEYS_BY_ITEM = new WeakMap<object, ReadonlyArray<string>>();

/**
 * How many distinct designs a thread's messages mention, for the tab badge. A message object
 * is scanned once and remembered, so a streaming reply costs one scan per tick, not the thread.
 */
export function countDesigns(items: ReadonlyArray<{ readonly text: string }>): number {
  const all = new Set<string>();
  for (const item of items) {
    let keys = KEYS_BY_ITEM.get(item);
    if (keys === undefined) {
      keys = designKeys(item.text);
      KEYS_BY_ITEM.set(item, keys);
    }
    for (const key of keys) all.add(key);
  }
  return all.size;
}
