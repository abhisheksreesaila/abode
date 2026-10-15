import { describe, expect, it } from "@effect/vitest";
import * as Schema from "effect/Schema";

import { VoiceSessionInput, WsVoiceRpc } from "./abodeVoice.ts";

const toJson = Schema.encodeSync(Schema.fromJsonString(VoiceSessionInput));
const fromJson = Schema.decodeUnknownSync(Schema.fromJsonString(VoiceSessionInput));

// The RPC layer speaks JSON, so audio must survive a round trip as base64 text.
describe("voice.session wire format", () => {
  it("carries PCM bytes as base64 in JSON and gets the same bytes back", () => {
    const pcm = Uint8Array.of(0, 1, 2, 3, 254, 255);
    const json = toJson({ op: "audio", sessionId: "v1", seq: 3, pcm });

    expect(JSON.parse(json)).toEqual({ op: "audio", sessionId: "v1", seq: 3, pcm: "AAECA/7/" });
    expect(fromJson(json)).toEqual({ op: "audio", sessionId: "v1", seq: 3, pcm });
  });

  it("is a single RPC named voice.session", () => {
    expect(WsVoiceRpc._tag).toBe("voice.session");
  });

  it("rejects an operation it does not know", () => {
    expect(() => fromJson(JSON.stringify({ op: "format-disk" }))).toThrow();
  });
});
