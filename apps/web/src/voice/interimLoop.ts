import type { PcmSnapshot } from "./pcmBuffer";

/**
 * Re-transcribes the audio captured so far on a timer while the user is still speaking.
 * At most one job is ever in flight: a tick that finds the worker busy is skipped, so
 * a slow device falls behind gracefully instead of building a queue.
 */
export function startInterimLoop(input: {
  intervalMs: number;
  /** Null when there is not enough audio yet. */
  snapshot: () => PcmSnapshot | null;
  transcribe: (audio: Float32Array) => Promise<string>;
  onText: (text: string) => void;
}): () => void {
  let busy = false;
  let stopped = false;
  const timer = setInterval(() => {
    if (busy || stopped) return;
    const snapshot = input.snapshot();
    if (!snapshot) return;
    busy = true;
    input
      .transcribe(snapshot.audio)
      .then((text) => {
        const trimmed = text.trim();
        if (!stopped && trimmed.length > 0) {
          input.onText(snapshot.truncated ? `…${trimmed}` : trimmed);
        }
      })
      // A failed preview is not an error; the final transcription reports real problems.
      .catch(() => {})
      .finally(() => {
        busy = false;
      });
  }, input.intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
