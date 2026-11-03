import { DEFAULT_MODE, type SessionMode } from "./sessionMode";
import type { SessionPill } from "./sessionPills";

/** The pills' compose input; a session without a stored mode is on Autopilot. */
export function composeSessions(
  pills: ReadonlyArray<SessionPill>,
  modes: Readonly<Record<string, SessionMode>>,
): ComposeSession[] {
  return pills.map((pill) => ({
    key: pill.key,
    mode: modes[pill.key] ?? DEFAULT_MODE,
    pending: pill.pending,
    status: pill.status,
  }));
}

/** The first one or two lines of an assistant message, without markdown markers. */
export function briefLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 2)
    .map((line) => (line.length > 160 ? `${line.slice(0, 157)}...` : line));
}

export interface ComposeSession {
  readonly key: string;
  readonly mode: SessionMode;
  readonly pending: "approval" | "input" | null;
  readonly status: "waiting on you" | "blocked" | "landed" | null;
}

export type Block =
  | { readonly block: "status" }
  | { readonly block: "plan" }
  | { readonly block: "made" }
  | {
      readonly block: "interrupt" | "grill" | "answers" | "jamintro" | "chat" | "sbrief";
      readonly sessionKey: string;
    }
  | { readonly block: "side"; readonly items: ReadonlyArray<Block> };

export type Row = ReadonlyArray<Block>;

/**
 * The workspace body from the live sessions' modes (spec 5.8, minus the journey map and the
 * design board): status, an interrupt per session needing the user, then Grill me and Jam
 * blocks, then the plan beside the Tell me briefs and the Autopilot "made" line.
 */
export function composeBlocks(sessions: ReadonlyArray<ComposeSession>): ReadonlyArray<Row> {
  const rows: Block[][] = [[{ block: "status" }]];
  for (const session of sessions) {
    // A Grill me session's pending question is the grill card itself.
    const isGrillQuestion = session.mode === "grill" && session.pending === "input";
    if (session.pending !== null && !isGrillQuestion) {
      rows.push([{ block: "interrupt", sessionKey: session.key }]);
    }
  }
  for (const session of sessions) {
    if (session.mode === "grill") {
      rows.push([
        { block: "grill", sessionKey: session.key },
        { block: "answers", sessionKey: session.key },
      ]);
    }
  }
  for (const session of sessions) {
    if (session.mode === "jam") {
      rows.push([
        { block: "jamintro", sessionKey: session.key },
        { block: "chat", sessionKey: session.key },
      ]);
    }
  }
  const side: Block[] = sessions
    .filter((session) => session.mode === "tell")
    .map((session) => ({ block: "sbrief", sessionKey: session.key }));
  if (sessions.some((session) => session.mode === "auto")) side.push({ block: "made" });
  rows.push(
    side.length > 0 ? [{ block: "plan" }, { block: "side", items: side }] : [{ block: "plan" }],
  );
  return rows;
}

/** One sentence for the top of the body. */
export function statusSentence(sessions: ReadonlyArray<ComposeSession>): string {
  if (sessions.length === 0) return "No live sessions.";
  const count = (status: ComposeSession["status"]) =>
    sessions.filter((session) => session.status === status).length;
  const parts = [`${sessions.length} live ${sessions.length === 1 ? "session" : "sessions"}`];
  if (count("waiting on you") > 0) parts.push(`${count("waiting on you")} waiting on you`);
  if (count("blocked") > 0) parts.push(`${count("blocked")} blocked`);
  return `${parts.join(", ")}.`;
}

/** Spec 5.5 routing, step 2: the open Grill me, then a jam, then needs-you, then the first. */
export function routedSession<T extends ComposeSession>(sessions: ReadonlyArray<T>): T | undefined {
  return (
    sessions.find((session) => session.mode === "grill") ??
    sessions.find((session) => session.mode === "jam") ??
    sessions.find(
      (session) => session.status === "blocked" || session.status === "waiting on you",
    ) ??
    sessions[0]
  );
}
