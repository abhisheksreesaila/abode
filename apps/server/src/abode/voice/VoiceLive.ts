/**
 * The production Voice: sherpa-onnx in a worker thread, the model in the state directory.
 * `ws.ts` provides `layer`; tests build `Voice.layerWith` over fakes instead.
 *
 * @module abode/voice/VoiceLive
 */
import * as Layer from "effect/Layer";

import * as Voice from "./Voice.ts";
import * as VoiceModelStore from "./VoiceModelStore.ts";
import * as VoiceRecognizerSherpa from "./VoiceRecognizerSherpa.ts";

export { Voice } from "./Voice.ts";

export const layer = Voice.layer.pipe(
  Layer.provide(VoiceRecognizerSherpa.layer),
  Layer.provide(VoiceModelStore.layer),
);
