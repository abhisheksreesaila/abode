// @effect-diagnostics nodeBuiltinImport:off - reads a wav fixture from outside the repo.
/**
 * The real 450 MB model end to end, skipped unless it and a clip are on disk:
 * `ABODE_VOICE_MODEL_DIR=<dir> ABODE_VOICE_CLIP=<16 kHz mono wav + sibling .txt of its words>
 * vp test run src/abode/voice/Voice.real.test.ts`
 */
import * as NodeFS from "node:fs";

import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as Voice from "./Voice.ts";
import { VoiceModelStore } from "./VoiceModelStore.ts";
import * as VoiceRecognizerSherpa from "./VoiceRecognizerSherpa.ts";

const modelDir = process.env.ABODE_VOICE_MODEL_DIR;
const clip = process.env.ABODE_VOICE_CLIP;
const ready = Boolean(modelDir && clip && NodeFS.existsSync(modelDir) && NodeFS.existsSync(clip));

/** Words only, lowercase: the model says "use thread menu" where the reference writes `useThreadMenu`. */
const words = (text: string) =>
  text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Samples of a 16 kHz, 16-bit mono wav as the little-endian PCM bytes the RPC carries. */
function readPcm(file: string): Uint8Array {
  const wav = NodeFS.readFileSync(file);
  const dataAt = wav.indexOf("data") + 8;
  return new Uint8Array(wav.buffer, wav.byteOffset + dataAt, wav.length - dataAt);
}

describe.skipIf(!ready)("Voice with the real Nemotron model", () => {
  it.live("turns a spoken clip into its words", () => {
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
      const started = yield* voice.handle({ op: "start" }, 1);
      if (started.op !== "started") return expect.fail("expected a session");
      const pcm = readPcm(clip ?? "");
      // 200 ms chunks, like the browser sends.
      const chunkBytes = 16_000 * 2 * 0.2;
      let seq = 0;
      for (let at = 0; at < pcm.length; at += chunkBytes, seq += 1) {
        yield* voice.handle(
          { op: "audio", sessionId: started.sessionId, seq, pcm: pcm.slice(at, at + chunkBytes) },
          1,
        );
      }
      const done = yield* voice.handle(
        { op: "finish", sessionId: started.sessionId, chunks: seq },
        1,
      );
      if (done.op !== "text") return expect.fail("expected text");

      const reference = words(NodeFS.readFileSync((clip ?? "").replace(/\.wav$/, ".txt"), "utf8"));
      expect(words(done.text)).toEqual(reference);
      expect(yield* voice.status).toMatchObject({ model: "ready", loaded: true });
    }).pipe(Effect.provide(layer));
  });
});
