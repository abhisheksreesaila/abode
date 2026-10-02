/**
 * Pure logic for the project welcome hero (F-026): what to show from a
 * project's README and thread list. No React, no I/O.
 */

const TAGLINE_MAX_LENGTH = 140;
// The emoji hunt stays near the top so a table of checkmarks in the docs
// does not become the project's face.
const EMOJI_SCAN_LENGTH = 1000;

const EMOJI_PATTERN =
  /\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}]|‍\p{Extended_Pictographic}️?)*/gu;
// Pictographic by Unicode, but plain text in a README.
const NOT_EMOJI = new Set(["©", "®", "™"]);

export interface ReadmeWelcome {
  readonly emoji: string | null;
  readonly tagline: string | null;
}

/** Collapses whitespace and cuts at a word boundary with an ellipsis. */
export function trimTagline(text: string, max = TAGLINE_MAX_LENGTH): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const head = flat.slice(0, max - 1);
  const lastSpace = head.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? head.slice(0, lastSpace) : head;
  return `${cut.replace(/[\s,;:.\-–—]+$/, "")}…`;
}

function stripInlineMarkdown(line: string): string {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])([*_])([^*_]+)\2(?![\w*])/g, "$1$3")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstEmoji(text: string): string | null {
  for (const match of text.slice(0, EMOJI_SCAN_LENGTH).matchAll(EMOJI_PATTERN)) {
    if (!NOT_EMOJI.has(match[0])) return match[0];
  }
  return null;
}

function isFence(line: string) {
  return /^\s*(```|~~~)/.test(line);
}

function isHeading(line: string) {
  return /^\s{0,3}#{1,6}\s/.test(line);
}

/** Lines of the README with front matter, comments and fenced code removed. */
function proseLines(markdown: string): string[] {
  const text = markdown
    .replace(/^﻿/, "")
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const lines: string[] = [];
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (isFence(line)) {
      // Keep one marker so "the title is followed by code" still reads as not prose.
      if (!inFence) lines.push("```");
      inFence = !inFence;
      continue;
    }
    if (!inFence) lines.push(line);
  }
  return lines;
}

function findTitleEnd(lines: readonly string[]): number {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (/^\s{0,3}#\s+\S/.test(line)) return i + 1;
    if (/^\s{0,3}=+\s*$/.test(lines[i + 1] ?? "") && line.trim() !== "" && !isHeading(line)) {
      return i + 2;
    }
  }
  return 0;
}

function isBadgeOrHtmlOnly(line: string) {
  const stripped = line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\s*\]\([^)]*\)/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\s[\]()]/g, "");
  return stripped === "";
}

function readTagline(lines: readonly string[], start: number): string | null {
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === "" || isBadgeOrHtmlOnly(line)) {
      i += 1;
      continue;
    }
    if (isHeading(line) || /^\s*([-*+]|\d+[.)])\s/.test(line) || /^\s*\|/.test(line)) return null;
    if (isFence(line)) return null;

    const block: string[] = [];
    const isQuote = /^\s*>/.test(line);
    while (i < lines.length) {
      const current = lines[i]!;
      if (current.trim() === "" || isHeading(current) || isFence(current)) break;
      if (isQuote !== /^\s*>/.test(current)) break;
      block.push(isQuote ? current.replace(/^\s*>\s?/, "") : current);
      i += 1;
    }
    const text = stripInlineMarkdown(block.join(" "));
    // GitHub alert markers ("[!NOTE]") are not a tagline.
    if (text !== "" && !/^\[!\w+\]/.test(text)) return trimTagline(text);
  }
  return null;
}

/**
 * The README's first emoji and a one-line tagline: the first paragraph or
 * blockquote after the H1 (or the first one in the file when there is no H1),
 * skipping badges, images and html wrappers.
 */
export function parseReadmeWelcome(markdown: string): ReadmeWelcome {
  const lines = proseLines(markdown);
  return {
    emoji: firstEmoji(markdown),
    tagline: readTagline(lines, findTitleEnd(lines)),
  };
}

const FALLBACK_EMOJIS = [
  "🚀",
  "🧩",
  "🛠️",
  "🌱",
  "🔭",
  "🧪",
  "📦",
  "🎯",
  "🧭",
  "💡",
  "🗺️",
  "🔧",
  "🧱",
  "🌊",
  "🔥",
  "🪴",
] as const;

/** A stable emoji for a project without one in its README. */
export function pickProjectEmoji(name: string): string {
  const key = name.trim().toLowerCase();
  if (key === "") return "📁";
  let hash = 5381;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return FALLBACK_EMOJIS[Math.abs(hash) % FALLBACK_EMOJIS.length]!;
}

/** `/home/ada/code/x` becomes `~/code/x`; anything else is left as it is. */
export function shortenHomePath(path: string): string {
  return path.replace(/^\/(?:home|Users)\/[^/]+(?=\/|$)/, "~");
}

export interface WelcomeThread {
  readonly title: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  readonly session: { readonly status: string } | null;
}

export interface ProjectThreadSummary<T extends WelcomeThread> {
  readonly total: number;
  readonly running: number;
  readonly latest: T | null;
}

/** Open (unarchived) thread count, how many are running, and the most recently touched one. */
export function summarizeProjectThreads<T extends WelcomeThread>(
  threads: readonly T[],
): ProjectThreadSummary<T> {
  let total = 0;
  let running = 0;
  let latest: T | null = null;
  for (const thread of threads) {
    if (thread.archivedAt !== null) continue;
    total += 1;
    if (thread.session?.status === "running" || thread.session?.status === "starting") {
      running += 1;
    }
    if (latest === null || thread.updatedAt > latest.updatedAt) latest = thread;
  }
  return { total, running, latest };
}

/** Text the starter cards drop into the composer; the user finishes the sentence. */
export function buildStarterPrompts(projectName: string) {
  return {
    feature: "I'd like to add a feature: ",
    bug: "I'm seeing a bug: ",
    explain: `Give me a tour of how ${projectName} works: the main parts and how they fit together.`,
  } as const;
}
