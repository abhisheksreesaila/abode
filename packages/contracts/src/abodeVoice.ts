import * as Schema from "effect/Schema";
import * as Rpc from "effect/rpc/Rpc";

import { EnvironmentAuthorizationError } from "./auth.ts";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

/**
 * Host dictation: the client streams 16 kHz mono 16-bit LE PCM (base64, the RPC is JSON) and
 * gets the text when the user stops. One RPC with an `op` discriminator keeps the hook into
 * `rpc.ts` a single add-only method. Chunks carry a sequence number: unary calls can reorder.
 */
export const VOICE_SAMPLE_RATE = 16_000;

/** `unsupported`: this server cannot run the model (platform, packaging). */
export const VoiceModelState = Schema.Literals([
  "unsupported",
  "missing",
  "downloading",
  "ready",
  "failed",
]);
export type VoiceModelState = typeof VoiceModelState.Type;

export const VoiceStatus = Schema.Struct({
  engine: Schema.Literal("nemotron"),
  model: VoiceModelState,
  /** 0..1 while `model` is `downloading`. */
  progress: Schema.optional(Schema.Number),
  /** Model size on disk once `ready`, or the download size while it is not. */
  sizeBytes: Schema.optional(Schema.Number),
  /** The model is in memory right now (it unloads after a few idle minutes). */
  loaded: Schema.Boolean,
  /** Why `model` is `failed` or `unsupported`. */
  message: Schema.optional(Schema.String),
});
export type VoiceStatus = typeof VoiceStatus.Type;

export const VoiceSessionInput = Schema.Union([
  Schema.Struct({ op: Schema.Literal("status") }),
  /** Starts the model download when it is missing; returns the status either way. */
  Schema.Struct({ op: Schema.Literal("prepare") }),
  Schema.Struct({ op: Schema.Literal("start") }),
  Schema.Struct({
    op: Schema.Literal("audio"),
    sessionId: TrimmedNonEmptyString,
    /** 0-based, consecutive per session. */
    seq: Schema.Int,
    pcm: Schema.Uint8ArrayFromBase64,
  }),
  Schema.Struct({
    op: Schema.Literal("finish"),
    sessionId: TrimmedNonEmptyString,
    /** How many `audio` chunks were sent, so late ones are waited for. */
    chunks: Schema.Int,
  }),
  Schema.Struct({ op: Schema.Literal("cancel"), sessionId: TrimmedNonEmptyString }),
]);
export type VoiceSessionInput = typeof VoiceSessionInput.Type;

export const VoiceSessionResult = Schema.Union([
  Schema.Struct({ op: Schema.Literal("status"), status: VoiceStatus }),
  Schema.Struct({ op: Schema.Literal("started"), sessionId: TrimmedNonEmptyString }),
  Schema.Struct({ op: Schema.Literal("ok") }),
  Schema.Struct({ op: Schema.Literal("text"), text: Schema.String }),
]);
export type VoiceSessionResult = typeof VoiceSessionResult.Type;

export const VoiceFailure = Schema.Literals([
  "unavailable",
  "busy",
  "unknown_session",
  "too_long",
  "too_large",
  "out_of_order",
  "failed",
]);
export type VoiceFailure = typeof VoiceFailure.Type;

export class VoiceError extends Schema.TaggedError<VoiceError>()("VoiceError", {
  failure: VoiceFailure,
  message: TrimmedNonEmptyString,
  cause: Schema.optional(Schema.Defect()),
}) {}

export const WsVoiceRpc = Rpc.make("voice.session", {
  payload: VoiceSessionInput,
  success: VoiceSessionResult,
  error: Schema.Union([VoiceError, EnvironmentAuthorizationError]),
});
