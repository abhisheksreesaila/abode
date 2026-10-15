import { createDownsampler, createPcmStore } from "./pcmBuffer";
import { levelOf } from "./voiceLevel";

export interface ActiveRecording {
  /** Stops capturing and resolves with 16 kHz mono samples. */
  finish: () => Promise<Float32Array>;
  /** Stops capturing and throws the audio away. */
  discard: () => void;
  /** 0..1 loudness of the latest audio, for the listening bars. */
  level: () => number;
}

export const INSECURE_CONTEXT_MESSAGE = "Voice needs HTTPS (use Tailscale HTTPS or localhost).";

export class InsecureContextError extends Error {
  constructor() {
    super(INSECURE_CONTEXT_MESSAGE);
  }
}

/** One-line, user-facing text for a failed `getUserMedia` call. */
export function describeMicrophoneError(error: unknown): string {
  if (error instanceof InsecureContextError) return INSECURE_CONTEXT_MESSAGE;
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone blocked. Allow it in system settings.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone found.";
  }
  if (name === "NotReadableError") return "The microphone is in use by another app.";
  return "Couldn't start the microphone.";
}

export interface RecordingOptions {
  /** Called with each 16 kHz chunk as it is captured (and with the tail when `finish` runs). */
  onSamples?: (samples: Float32Array) => void;
}

export async function startRecording(options: RecordingOptions = {}): Promise<ActiveRecording> {
  // Browsers hide mediaDevices on insecure origins (plain http that is not localhost).
  if (!navigator.mediaDevices?.getUserMedia) throw new InsecureContextError();
  // Create and resume the context before the first await: Safari only allows that inside
  // the user gesture, and awaiting getUserMedia (a permission prompt) ends the gesture.
  // Capture is at the device rate and downsampled ourselves, since Firefox refuses to
  // connect a MediaStream whose rate differs from the context's.
  const context = new AudioContext();
  void context.resume();
  let processor: ScriptProcessorNode | null = null;
  let stream: MediaStream | null = null;
  let released = false;
  // Idempotent: every exit path (finish, discard, setup failure) frees the mic.
  const release = () => {
    if (released) return;
    released = true;
    if (processor) processor.onaudioprocess = null;
    processor?.disconnect();
    for (const track of stream?.getTracks() ?? []) track.stop();
    void context.close();
  };
  const store = createPcmStore();
  const keep = (samples: Float32Array) => {
    store.push(samples);
    options.onSamples?.(samples);
  };
  const downsample = createDownsampler(context.sampleRate);
  let level = 0;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = context.createMediaStreamSource(stream);
    // ScriptProcessor is a deliberate choice (no worklet file, no blob/CSP issues); it is
    // deprecated, so move to an AudioWorklet later. A small buffer limits the unflushed tail.
    processor = context.createScriptProcessor(2048, 1, 1);
    processor.onaudioprocess = (event) => {
      if (released) return;
      const samples = event.inputBuffer.getChannelData(0);
      level = levelOf(samples);
      keep(downsample(samples));
    };
    // A processor only runs while connected to the destination; the zero gain keeps it silent.
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(context.destination);
  } catch (error) {
    release();
    throw error;
  }
  return {
    discard: release,
    finish: async () => {
      release();
      keep(downsample.flush());
      return store.all();
    },
    level: () => (released ? 0 : level),
  };
}
