/**
 * VoiceModelStore - where the speech model lives on the host (`<state dir>/abode/models`) and
 * how it gets there. A port so `Voice` can be tested without a 450 MB download.
 *
 * @module abode/voice/VoiceModelStore
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { ServerConfig } from "../../config.ts";
import {
  ModelInstallFailed,
  NEMOTRON_560_INT8,
  installModel,
  installedModelBytes,
  isModelInstalled,
} from "./modelInstall.ts";

export class VoiceModelInstallError extends Schema.TaggedError<VoiceModelInstallError>()(
  "VoiceModelInstallError",
  {
    failure: Schema.Literals([
      "insecure_url",
      "download",
      "too_large",
      "checksum",
      "unsafe_archive",
      "extract",
      "incomplete",
      "install",
    ]),
    cause: Schema.optional(Schema.Defect()),
  },
) {
  override get message(): string {
    switch (this.failure) {
      case "checksum":
        return "The downloaded speech model was damaged. Try again.";
      case "unsafe_archive":
      case "extract":
      case "incomplete":
        return "The downloaded speech model could not be unpacked.";
      case "insecure_url":
      case "download":
      case "too_large":
        return "Couldn't download the speech model. Check the connection and retry.";
      case "install":
        return "Couldn't save the speech model on this computer.";
    }
  }
}

export class VoiceModelStore extends Context.Service<
  VoiceModelStore,
  {
    readonly modelDir: string;
    /** Size of the download, for the progress label. */
    readonly archiveBytes: number;
    /** Bytes on disk once installed, or null while the model is missing. */
    readonly installedBytes: Effect.Effect<number | null>;
    readonly install: (
      onProgress: (fraction: number) => void,
    ) => Effect.Effect<void, VoiceModelInstallError>;
  }
>()("t3/abode/voice/VoiceModelStore") {}

const make = Effect.gen(function* () {
  const config = yield* ServerConfig;
  const path = yield* Path.Path;
  const spec = NEMOTRON_560_INT8;
  const modelsRoot = path.join(config.stateDir, "abode", "models");

  return VoiceModelStore.of({
    modelDir: path.join(modelsRoot, spec.id),
    archiveBytes: spec.archiveBytes,
    installedBytes: Effect.promise(async () =>
      (await isModelInstalled(spec, modelsRoot)) ? installedModelBytes(spec, modelsRoot) : null,
    ),
    install: (onProgress) =>
      Effect.tryPromise({
        try: () => installModel({ spec, modelsRoot, onProgress }),
        catch: (cause) =>
          new VoiceModelInstallError({
            failure: cause instanceof ModelInstallFailed ? cause.failure : "install",
            cause,
          }),
      }),
  });
});

export const layer = Layer.effect(VoiceModelStore, make);
