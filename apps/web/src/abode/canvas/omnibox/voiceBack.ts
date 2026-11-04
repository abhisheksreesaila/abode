/** Voice back (spec 5.5): which session changes are worth saying out loud. Pure; no browser APIs. */

export type VoiceBackMode = "off" | "key" | "two";

const VOICE_BACK_MODES: ReadonlyArray<VoiceBackMode> = ["off", "key", "two"];

export const VOICE_BACK_LABEL: Record<VoiceBackMode, string> = {
  off: "voice back off",
  key: "key moments",
  two: "two-way",
};

export const nextVoiceBackMode = (mode: VoiceBackMode): VoiceBackMode =>
  VOICE_BACK_MODES[(VOICE_BACK_MODES.indexOf(mode) + 1) % VOICE_BACK_MODES.length] ?? "key";

export const sanitizeVoiceBackMode = (value: unknown): VoiceBackMode =>
  value === "off" || value === "two" ? value : "key";

export interface SessionSnapshot {
  readonly title: string;
  readonly status: "waiting on you" | "blocked" | "landed" | null;
  readonly pending: "approval" | "input" | null;
}

type PillLike = SessionSnapshot & { readonly key: string };

export function snapshotSessions(
  workspaces: ReadonlyArray<{ readonly sessions: { readonly pills: ReadonlyArray<PillLike> } }>,
): ReadonlyMap<string, SessionSnapshot> {
  const map = new Map<string, SessionSnapshot>();
  for (const workspace of workspaces) {
    for (const pill of workspace.sessions.pills) {
      map.set(pill.key, { title: pill.title, status: pill.status, pending: pill.pending });
    }
  }
  return map;
}

/**
 * Lines to speak for sessions that newly need you, got blocked or landed. An empty `prev`
 * is the initial load (nothing is said); a session first seen later counts as new.
 */
export function detectMoments(
  prev: ReadonlyMap<string, SessionSnapshot>,
  next: ReadonlyMap<string, SessionSnapshot>,
): string[] {
  if (prev.size === 0) return [];
  const lines: string[] = [];
  for (const [key, now] of next) {
    if (now.status === null) continue;
    const before = prev.get(key);
    const newRequest = now.status === "waiting on you" && before?.pending !== now.pending;
    if (before?.status === now.status && !newRequest) continue;
    if (now.status === "waiting on you") {
      const what =
        now.pending === "approval"
          ? " for an approval"
          : now.pending === "input"
            ? " to answer a question"
            : "";
      lines.push(`${now.title} needs you${what}.`);
    } else if (now.status === "blocked") lines.push(`${now.title} is blocked.`);
    else lines.push(`${now.title} landed.`);
  }
  return lines;
}

interface ReplyMessage {
  readonly id: string;
  readonly role: string;
  readonly text: string;
  readonly streaming: boolean;
}

const latestFinished = (messages: ReadonlyArray<ReplyMessage>) =>
  messages.findLast(
    (message) => message.role === "assistant" && !message.streaming && message.text.trim() !== "",
  );

export const latestFinishedId = (messages: ReadonlyArray<ReplyMessage>): string | null =>
  latestFinished(messages)?.id ?? null;

/** The reply to read aloud: the newest finished assistant message, if it is not the one already seen. */
export function replyToSpeak(
  messages: ReadonlyArray<ReplyMessage>,
  seenId: string | null,
): { readonly id: string; readonly text: string } | null {
  const latest = latestFinished(messages);
  return latest && latest.id !== seenId ? { id: latest.id, text: latest.text } : null;
}

/** `insert` placed at `at` in `text`, spaced from its neighbours; used for dictation in the omnibox. */
export function insertAt(text: string, at: number, insert: string): string {
  const pos = Math.max(0, Math.min(text.length, at));
  const before = text.slice(0, pos);
  const after = text.slice(pos);
  const lead = before !== "" && !/\s$/.test(before) && insert !== "" ? " " : "";
  const trail = after !== "" && !/^\s/.test(after) && insert !== "" ? " " : "";
  return `${before}${lead}${insert}${trail}${after}`;
}

const MAX_SPOKEN = 220;

/** First two sentences of a reply with markdown and code removed, capped. */
export function speechText(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_#>~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = plain.match(/[^.!?]+[.!?]*/g) ?? [plain];
  const short = sentences.slice(0, 2).join("").trim();
  return short.length > MAX_SPOKEN ? `${short.slice(0, MAX_SPOKEN - 1).trimEnd()}…` : short;
}
