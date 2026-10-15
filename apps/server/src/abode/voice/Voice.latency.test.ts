// @effect-diagnostics nodeBuiltinImport:off - reads a wav fixture from outside the repo.
/**
 * How long after the user stops talking the final text arrives, measured on the real service:
 * Voice -> worker thread -> sherpa-onnx -> Nemotron, with audio sent at the pace of speech in
 * 200 ms chunks (each one passed through the RPC's JSON encoding, as on the wire). The clock
 * runs from the moment the last chunk is handed over to the moment `finish` returns the text.
 * Skipped unless both files are given:
 *
 *   ABODE_VOICE_MODEL_DIR=<model dir> ABODE_VOICE_LATENCY_CLIP=<16 kHz mono wav, 2 minutes> \
 *   vp test run src/abode/voice/Voice.latency.test.ts
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "@effect/vitest";
import { VoiceSessionInput } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as Voice from "./Voice.ts";
import { VoiceModelStore } from "./VoiceModelStore.ts";
import * as VoiceRecognizerSherpa from "./VoiceRecognizerSherpa.ts";

const modelDir = process.env.ABODE_VOICE_MODEL_DIR;
const clip = process.env.ABODE_VOICE_LATENCY_CLIP;
const ready = Boolean(modelDir && clip && NodeFS.existsSync(modelDir) && NodeFS.existsSync(clip));

const overTheWire = Schema.decodeUnknownSync(Schema.fromJsonString(VoiceSessionInput));
const encode = Schema.encodeSync(Schema.fromJsonString(VoiceSessionInput));

function readPcm(file: string): Uint8Array {
  const wav = NodeFS.readFileSync(file);
  const dataAt = wav.indexOf("data") + 8;
  return new Uint8Array(wav.buffer, wav.byteOffset + dataAt, wav.length - dataAt);
}

describe.skipIf(!ready)("Voice end-to-end latency", () => {
  it.live(
    "returns the final text about a second or less after the last chunk",
    () => {
      const store = VoiceModelStore.of({
        modelDir: modelDir ?? "",
        archiveBytes: 1,
        installedBytes: Effect.succeed(1),
        install: () => Effect.void,
      });
      const layer = Voice.layer.pipe(
        Layer.provide(VoiceRecognizerSherpa.layer),
        Layer.provide(Layer.succeed(VoiceModelStore, store)),
      );
      return Effect.gen(function* () {
        const voice = yield* Voice.Voice;
        const pcm = readPcm(clip ?? "");
        const chunkBytes = 16_000 * 2 * 0.2;
        const chunks = Math.ceil(pcm.length / chunkBytes);
        const call = (input: VoiceSessionInput) => voice.handle(overTheWire(encode(input)), 1);

        const started = yield* call({ op: "start" });
        if (started.op !== "started") return expect.fail("expected a session");
        const begun = performance.now();
        for (let seq = 0; seq < chunks; seq += 1) {
          // Wait until this chunk's audio would have been spoken.
          const due = begun + (seq + 1) * 200;
          const wait = due - performance.now();
          if (wait > 0) yield* Effect.sleep(wait);
          yield* call({
            op: "audio",
            sessionId: started.sessionId,
            seq,
            pcm: pcm.slice(seq * chunkBytes, (seq + 1) * chunkBytes),
          });
        }
        const lastSent = performance.now();
        const done = yield* call({ op: "finish", sessionId: started.sessionId, chunks });
        const latencyMs = performance.now() - lastSent;
        if (done.op !== "text") return expect.fail("expected text");

        // Straight to stderr: the test reporter swallows console output.
        NodeFS.writeSync(
          2,
          `voice latency: ${Math.round(latencyMs)} ms after the last chunk, for ${(pcm.length / 32000).toFixed(1)} s of audio, ${done.text.split(/\s+/).length} words\n`,
        );
        expect(latencyMs).toBeLessThan(1000);
      }).pipe(Effect.provide(layer));
    },
    300_000,
  );
});
