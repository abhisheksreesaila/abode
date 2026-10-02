import {
  ASSISTANT_CITATION_MAX_TEXT_LENGTH,
  EnvironmentId,
  MessageId,
  ThreadId,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { isWholeMessageCitation } from "@t3tools/shared/assistantCitations";
import { buildAssistantMessageQuote } from "./assistantMessageQuote";

const base = {
  threadRef: { environmentId: EnvironmentId.make("env"), threadId: ThreadId.make("thread") },
  messageId: MessageId.make("m1"),
};

describe("buildAssistantMessageQuote", () => {
  it("quotes the whole message text", () => {
    const result = buildAssistantMessageQuote({ ...base, text: "Fixed the\nretry queue." });
    expect(result).toMatchObject({
      ok: true,
      citation: { messageId: "m1", text: "Fixed the\nretry queue.", start: 0, prefix: "" },
    });
    if (result.ok) {
      expect(result.citation.end).toBe(1);
      expect(isWholeMessageCitation(result.citation)).toBe(true);
    }
  });

  it("refuses a message over the citation limit", () => {
    const text = "a".repeat(ASSISTANT_CITATION_MAX_TEXT_LENGTH + 1);
    expect(buildAssistantMessageQuote({ ...base, text })).toEqual({
      ok: false,
      reason: "too-long",
    });
  });

  it("accepts a message exactly at the limit", () => {
    const text = "a".repeat(ASSISTANT_CITATION_MAX_TEXT_LENGTH);
    expect(buildAssistantMessageQuote({ ...base, text }).ok).toBe(true);
  });

  it("refuses an empty or blank message", () => {
    expect(buildAssistantMessageQuote({ ...base, text: "" })).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(buildAssistantMessageQuote({ ...base, text: "  \n " })).toEqual({
      ok: false,
      reason: "empty",
    });
  });
});
