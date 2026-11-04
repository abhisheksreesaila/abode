import { describe, expect, it } from "vite-plus/test";

import {
  detectMoments,
  insertAt,
  nextVoiceBackMode,
  replyToSpeak,
  sanitizeVoiceBackMode,
  speechText,
  type SessionSnapshot,
} from "./voiceBack";

const snap = (over: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  title: "Sync",
  status: null,
  pending: null,
  ...over,
});
const map = (entries: Record<string, SessionSnapshot>) => new Map(Object.entries(entries));

describe("detectMoments", () => {
  it("says nothing on the initial load", () => {
    expect(detectMoments(new Map(), map({ a: snap({ status: "blocked" }) }))).toEqual([]);
  });

  it("announces a session that newly needs you, with what it needs", () => {
    const prev = map({ a: snap() });
    expect(
      detectMoments(prev, map({ a: snap({ status: "waiting on you", pending: "approval" }) })),
    ).toEqual(["Sync needs you for an approval."]);
    expect(
      detectMoments(prev, map({ a: snap({ status: "waiting on you", pending: "input" }) })),
    ).toEqual(["Sync needs you to answer a question."]);
  });

  it("announces blocked and landed once, not on every update", () => {
    const prev = map({ a: snap(), b: snap({ title: "Docs" }) });
    const next = map({
      a: snap({ status: "blocked" }),
      b: snap({ title: "Docs", status: "landed" }),
    });
    expect(detectMoments(prev, next)).toEqual(["Sync is blocked.", "Docs landed."]);
    expect(detectMoments(next, next)).toEqual([]);
  });

  it("announces a new request on a session that was already waiting", () => {
    const prev = map({ a: snap({ status: "waiting on you", pending: "input" }) });
    const next = map({ a: snap({ status: "waiting on you", pending: "approval" }) });
    expect(detectMoments(prev, next)).toEqual(["Sync needs you for an approval."]);
  });

  it("says nothing when a session clears", () => {
    const prev = map({ a: snap({ status: "blocked" }) });
    expect(detectMoments(prev, map({ a: snap() }))).toEqual([]);
  });
});

describe("replyToSpeak", () => {
  const msg = (id: string, role: string, text: string, streaming = false) => ({
    id,
    role,
    text,
    streaming,
  });

  it("returns the newest finished assistant reply once", () => {
    const messages = [msg("1", "user", "hi"), msg("2", "assistant", "Done.")];
    expect(replyToSpeak(messages, null)).toEqual({ id: "2", text: "Done." });
    expect(replyToSpeak(messages, "2")).toBeNull();
  });

  it("waits while the reply is still streaming", () => {
    const messages = [msg("2", "assistant", "Done."), msg("3", "assistant", "Wor", true)];
    expect(replyToSpeak(messages, "2")).toBeNull();
  });
});

describe("speechText", () => {
  it("drops code and markdown and keeps two short sentences", () => {
    const text = "**Done.** I fixed `foo`.\n```ts\nconst x = 1;\n```\nThird sentence.";
    expect(speechText(text)).toBe("Done. I fixed foo.");
  });

  it("caps long replies", () => {
    expect(speechText("a".repeat(500))).toHaveLength(220);
  });
});

describe("insertAt", () => {
  it("inserts the transcript at the caret with single spaces around it", () => {
    expect(insertAt("fix the bug", 7, "login")).toBe("fix the login bug");
    expect(insertAt("", 0, "hello")).toBe("hello");
    expect(insertAt("hello ", 6, "world")).toBe("hello world");
    expect(insertAt("hi", 99, "there")).toBe("hi there");
  });
});

describe("voice back mode", () => {
  it("cycles off, key moments, two-way and defaults to key moments", () => {
    expect(nextVoiceBackMode("off")).toBe("key");
    expect(nextVoiceBackMode("key")).toBe("two");
    expect(nextVoiceBackMode("two")).toBe("off");
    expect(sanitizeVoiceBackMode(undefined)).toBe("key");
    expect(sanitizeVoiceBackMode("two")).toBe("two");
  });
});
