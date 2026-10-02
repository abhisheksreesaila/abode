const WHISPER_SAMPLE_RATE = 16_000;

export interface ActiveRecording {
  /** Stops capturing and resolves with 16 kHz mono samples. */
  finish: () => Promise<Float32Array>;
  /** Stops capturing and throws the audio away. */
  discard: () => void;
}

/** One-line, user-facing text for a failed `getUserMedia` call. */
export function describeMicrophoneError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow it in your browser or system settings.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone found.";
  }
  if (name === "NotReadableError") return "The microphone is in use by another app.";
  return "Couldn't start the microphone.";
}

export async function startRecording(): Promise<ActiveRecording> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("Microphone is unavailable here.", "NotFoundError");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  const stopped = new Promise<void>((resolve) =>
    recorder.addEventListener("stop", () => resolve(), { once: true }),
  );
  recorder.start();

  const release = () => {
    for (const track of stream.getTracks()) track.stop();
  };
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
