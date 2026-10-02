const WHISPER_SAMPLE_RATE = 16_000;

export interface ActiveRecording {
  /** Stops capturing and resolves with 16 kHz mono samples. */
  finish: () => Promise<Float32Array>;
  /** Stops capturing and throws the audio away. */
  discard: () => void;
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

export async function startRecording(): Promise<ActiveRecording> {
  // Browsers hide mediaDevices on insecure origins (plain http that is not localhost).
  if (!navigator.mediaDevices?.getUserMedia) throw new InsecureContextError();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const release = () => {
    for (const track of stream.getTracks()) track.stop();
  };
  let recorder: MediaRecorder;
  const chunks: Blob[] = [];
  let stopped: Promise<void>;
  try {
    recorder = new MediaRecorder(stream);
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    const active = recorder;
    stopped = new Promise<void>((resolve) =>
      active.addEventListener("stop", () => resolve(), { once: true }),
    );
    recorder.start();
  } catch (error) {
    release();
    throw error;
  }
  return {
    discard: () => {
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
    finish: async () => {
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      release();
      const bytes = await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer();
      const context = new AudioContext({ sampleRate: WHISPER_SAMPLE_RATE });
      try {
        const decoded = await context.decodeAudioData(bytes);
        return decoded.getChannelData(0).slice();
      } finally {
        void context.close();
      }
    },
  };
}
