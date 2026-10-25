#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off - reads a wav fixture from outside the repo.
/**
 * Real-model latency benchmark: from the last 200 ms chunk (sent at speech pace, JSON-encoded as on
 * the wire) to `finish` returning text. Run on demand, it prints its numbers and exits non-zero
 * over one second:
 *
 *   ABODE_VOICE_MODEL_DIR=<dir> ABODE_VOICE_LATENCY_CLIP=<16 kHz mono wav, ~2 minutes> \
 *     node scripts/abode/voice-latency.ts
 */
import * as NodeFS from "node:fs";

import { VoiceSessionInput } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as Voice from "../../src/abode/voice/Voice.ts";
import { VoiceModelStore } from "../../src/abode/voice/VoiceModelStore.ts";
import * as VoiceRecognizerSherpa from "../../src/abode/voice/VoiceRecognizerSherpa.ts";

const BUDGET_MS = 1000;

const modelDir = process.env.ABODE_VOICE_MODEL_DIR;
const clip = process.env.ABODE_VOICE_LATENCY_CLIP;
if (!modelDir || !clip || !NodeFS.existsSync(modelDir) || !NodeFS.existsSync(clip)) {
  process.stderr.write(
    "Set ABODE_VOICE_MODEL_DIR and ABODE_VOICE_LATENCY_CLIP to existing paths.\n",
  );
  process.exit(2);
}

const overTheWire = Schema.decodeUnknownSync(Schema.fromJsonString(VoiceSessionInput));
const encode = Schema.encodeSync(Schema.fromJsonString(VoiceSessionInput));

function readPcm(file: string): Uint8Array {
  const wav = NodeFS.readFileSync(file);
  const dataAt = wav.indexOf("data") + 8;
  return new Uint8Array(wav.buffer, wav.byteOffset + dataAt, wav.length - dataAt);
}

const store = VoiceModelStore.of({
  modelDir,
  archiveBytes: 1,
  installedBytes: Effect.succeed(1),
  install: () => Effect.void,
});
const layer = Voice.layer.pipe(
  Layer.provide(VoiceRecognizerSherpa.layer),
  Layer.provide(Layer.succeed(VoiceModelStore, store)),
);

const program = Effect.gen(function* () {
  const voice = yield* Voice.Voice;
  const pcm = readPcm(clip);
  const chunkBytes = 16_000 * 2 * 0.2;
  const chunks = Math.ceil(pcm.length / chunkBytes);
  const call = (input: VoiceSessionInput) => voice.handle(overTheWire(encode(input)), 1);

  const started = yield* call({ op: "start" });
  if (started.op !== "started") return yield* Effect.die("expected a session");
  const begun = performance.now();
  for (let seq = 0; seq < chunks; seq += 1) {
    // Wait until this chunk's audio would have been spoken.
    const wait = begun + (seq + 1) * 200 - performance.now();
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
  if (done.op !== "text") return yield* Effect.die("expected text");

  process.stdout.write(
    `voice latency: ${Math.round(latencyMs)} ms after the last chunk, for ${(pcm.length / 32000).toFixed(1)} s of audio, ${done.text.split(/\s+/).length} words\n`,
  );
  if (latencyMs >= BUDGET_MS) {
    process.stderr.write(`over the ${BUDGET_MS} ms budget\n`);
    process.exitCode = 1;
  }
}).pipe(Effect.provide(layer));

await Effect.runPromise(program);
