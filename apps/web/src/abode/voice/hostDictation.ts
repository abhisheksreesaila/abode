import type { VoiceSessionInput, VoiceSessionResult } from "@t3tools/contracts";

import { applyDevVocabulary } from "./devVocabulary";
import { SPEECH_SAMPLE_RATE } from "./pcmBuffer";

/** One request to the host's `voice.session` RPC. Rejects when the host refuses or is gone. */
export type VoiceCall = (input: VoiceSessionInput) => Promise<VoiceSessionResult>;

/** About 200 ms of speech per message: a handful of small requests a second, not dozens. */
export const CHUNK_SAMPLES = SPEECH_SAMPLE_RATE / 5;
/** Chunks on the wire at once. The host puts them back in order by sequence number. */
const MAX_IN_FLIGHT = 4;
/** How long `finish` may take, from the call, before the browser takes over. */
export const HOST_FINISH_TIMEOUT_MS = 10_000;

/** Float samples in -1..1 to 16-bit little-endian PCM, the wire format. */
export function floatToPcm16(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    view.setInt16(index * 2, Math.round(clamped * (clamped < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}

export interface HostDictation {
  /** Hands over microphone audio as it is captured. Never throws; errors surface in `finish`. */
  readonly push: (samples: Float32Array) => void;
  /** Sends what is left and resolves with the host's final text. Rejects if anything failed. */
  readonly finish: () => Promise<string>;
  /** Abandons the dictation on the host. Safe to call at any time, more than once. */
  readonly cancel: () => void;
}

/**
 * One dictation on the host. Audio can start arriving before the host has answered `start`; it
 * is queued and sent in order once there is a session. Any failure along the way is remembered
 * and reported by `finish`, so the caller can fall back to transcribing in the browser.
 */
export function createHostDictation(call: VoiceCall): HostDictation {
  const queue: Array<{ seq: number; pcm: Uint8Array }> = [];
  let buffered: Float32Array[] = [];
  let bufferedSamples = 0;
  let nextSeq = 0;
  let inFlight = 0;
  let sessionId: string | null = null;
  let failure: Error | null = null;
  let cancelled = false;
  let onSettled: (() => void) | null = null;
  let onCancelled: (() => void) | null = null;

  const toError = (cause: unknown) => (cause instanceof Error ? cause : new Error(String(cause)));
  const settled = () => {
    onSettled?.();
  };

  const started = call({ op: "start" }).then(
    (result) => {
      if (result.op !== "started") throw new Error("The host did not start a dictation.");
      sessionId = result.sessionId;
      if (cancelled) void call({ op: "cancel", sessionId }).catch(() => undefined);
      pump();
    },
    (cause: unknown) => {
      failure ??= toError(cause);
      settled();
    },
  );

  const canSend = () => failure === null && inFlight < MAX_IN_FLIGHT && queue.length > 0;
  const isWorking = () => failure === null && (queue.length > 0 || inFlight > 0);

  function pump() {
    if (sessionId === null || cancelled) return;
    while (canSend()) {
      const chunk = queue.shift();
      if (!chunk) break;
      inFlight += 1;
      call({ op: "audio", sessionId, seq: chunk.seq, pcm: chunk.pcm }).then(
        () => {
          inFlight -= 1;
          pump();
          settled();
        },
        (cause: unknown) => {
          inFlight -= 1;
          failure ??= toError(cause);
          settled();
        },
      );
    }
  }

  function cut(count: number) {
    const joined = new Float32Array(count);
    let offset = 0;
    while (offset < count) {
      const head = buffered[0];
      if (!head) break;
      const take = Math.min(head.length, count - offset);
      joined.set(head.subarray(0, take), offset);
      offset += take;
      if (take === head.length) buffered.shift();
      else buffered[0] = head.subarray(take);
    }
    bufferedSamples -= count;
    queue.push({ seq: nextSeq++, pcm: floatToPcm16(joined) });
  }

  return {
    push: (samples) => {
      if (cancelled || failure !== null || samples.length === 0) return;
      buffered.push(samples);
      bufferedSamples += samples.length;
      while (bufferedSamples >= CHUNK_SAMPLES) cut(CHUNK_SAMPLES);
      pump();
    },
    finish: () => {
      if (cancelled) return Promise.reject(new Error("The dictation was cancelled."));
      let timer: ReturnType<typeof setTimeout> | undefined;
      const limit = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          failure ??= new Error("The host took too long.");
          if (sessionId !== null) void call({ op: "cancel", sessionId }).catch(() => undefined);
          reject(failure);
        }, HOST_FINISH_TIMEOUT_MS);
        onCancelled = () => reject(new Error("The dictation was cancelled."));
      });
      return Promise.race([finishInner(), limit]).finally(() => {
        clearTimeout(timer);
        onCancelled = null;
      });
    },
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      onCancelled?.();
      queue.length = 0;
      buffered = [];
      bufferedSamples = 0;
      if (sessionId !== null) void call({ op: "cancel", sessionId }).catch(() => undefined);
    },
  };

  async function finishInner(): Promise<string> {
    if (bufferedSamples > 0) cut(bufferedSamples);
    buffered = [];
    await started;
    pump();
    while (isWorking()) {
      await new Promise<void>((resolve) => {
        onSettled = resolve;
      });
    }
    onSettled = null;
    if (failure !== null) throw failure;
    if (sessionId === null) throw new Error("The host did not start a dictation.");
    const result = await call({ op: "finish", sessionId, chunks: nextSeq });
    if (result.op !== "text") throw new Error("The host did not return text.");
    return result.text;
  }
}

/**
 * The final text of a dictation: the host's when `dictation` delivers it (with the developer
 * vocabulary applied, like the browser path), otherwise whatever `browser` makes of the
 * recording. A host that fails at any point just means the browser model does the work.
 */
export async function textFromHostOrBrowser(
  dictation: HostDictation | null,
  browser: () => Promise<string>,
  /** False once the dictation was cancelled: then nothing falls back to the browser. */
  isCurrent: () => boolean = () => true,
): Promise<string> {
  if (dictation) {
    try {
      return applyDevVocabulary(await dictation.finish());
    } catch {
      if (!isCurrent()) throw new DOMException("Dictation cancelled.", "AbortError");
      // Fall through: the recording is complete in the browser.
    }
  }
  return browser();
}
