/**
 * VoiceRecognizer - the port between the dictation sessions (`Voice`) and whatever turns
 * audio into text. The live implementation runs sherpa-onnx in a worker thread
 * (`VoiceRecognizerSherpa`); tests supply a fake.
 *
 * @module abode/voice/VoiceRecognizer
 */
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export class VoiceRecognizerError extends Schema.TaggedError<VoiceRecognizerError>()(
  "VoiceRecognizerError",
  {
    reason: Schema.Literals(["unsupported", "load", "decode"]),
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message(): string {
    return this.reason === "unsupported"
      ? "Speech recognition is not available on this server."
      : this.reason === "load"
        ? "The speech model could not be loaded."
        : "The speech model failed while listening.";
  }
}

/** One dictation. Samples are 16 kHz mono floats in -1..1, in the order they were spoken. */
export interface RecognizerSession {
  readonly accept: (samples: Float32Array) => Effect.Effect<void, VoiceRecognizerError>;
  /** Text of everything accepted so far; the session is over afterwards. */
  readonly finish: Effect.Effect<string, VoiceRecognizerError>;
  /** Abandons the dictation. Safe to call after `finish`. */
  readonly close: Effect.Effect<void>;
}

export class VoiceRecognizer extends Context.Service<
  VoiceRecognizer,
  {
    /** Null when this server can run the model, else why not (shown in Settings). */
    readonly unsupportedReason: Effect.Effect<string | null>;
    /** Loads the model if it is not in memory yet. */
    readonly open: (modelDir: string) => Effect.Effect<RecognizerSession, VoiceRecognizerError>;
    /** The model is in memory right now. */
    readonly loaded: Effect.Effect<boolean>;
    /** Frees the model. Open sessions fail. The next `open` loads it again. */
    readonly unload: Effect.Effect<void>;
  }
>()("t3/abode/voice/VoiceRecognizer") {}
