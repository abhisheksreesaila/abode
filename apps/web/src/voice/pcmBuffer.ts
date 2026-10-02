/**
 * Pure helpers for live capture: turn whatever rate the microphone runs at into 16 kHz mono
 * chunks, and read the audio so far (or just its tail) without re-decoding anything.
 */
export const SPEECH_SAMPLE_RATE = 16_000;

function concat(parts: readonly Float32Array[], length: number): Float32Array {
  const joined = new Float32Array(length);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

/**
 * Stateful box-filter resampler. Feed it consecutive chunks; it carries the unconsumed
 * tail between calls so chunk boundaries do not click.
 */
export function createDownsampler(inputRate: number, outputRate = SPEECH_SAMPLE_RATE) {
  const ratio = inputRate / outputRate;
  let carry = new Float32Array(0);
  let phase = 0;
  return (input: Float32Array): Float32Array => {
    if (ratio === 1) return input.slice();
    const buffer = concat([carry, input], carry.length + input.length);
    const out: number[] = [];
    let position = phase;
    while (position + ratio <= buffer.length) {
      const start = Math.floor(position);
      const end = Math.max(start + 1, Math.min(buffer.length, Math.ceil(position + ratio)));
      let sum = 0;
      for (let i = start; i < end; i++) sum += buffer[i] ?? 0;
      out.push(sum / (end - start));
      position += ratio;
    }
    const consumed = Math.floor(position);
    carry = buffer.slice(consumed);
    phase = position - consumed;
    return Float32Array.from(out);
  };
}

export interface PcmSnapshot {
  audio: Float32Array;
  /** True when older audio was left out to keep the window bounded. */
  truncated: boolean;
}

/** Append-only store of 16 kHz chunks with cheap whole and tail reads. */
export function createPcmStore() {
  const chunks: Float32Array[] = [];
  let total = 0;
  return {
    push(chunk: Float32Array) {
      if (chunk.length === 0) return;
      chunks.push(chunk);
      total += chunk.length;
    },
    get length() {
      return total;
    },
    all(): Float32Array {
      return concat(chunks, total);
    },
    /** A copy of the last `maxSamples` samples (the whole recording if it is shorter). */
    tail(maxSamples: number): PcmSnapshot {
      if (total <= maxSamples) return { audio: concat(chunks, total), truncated: false };
      const audio = new Float32Array(maxSamples);
      let filled = maxSamples;
      for (let i = chunks.length - 1; i >= 0 && filled > 0; i--) {
        const chunk = chunks[i]!;
        const take = Math.min(chunk.length, filled);
        audio.set(chunk.subarray(chunk.length - take), filled - take);
        filled -= take;
      }
      return { audio, truncated: true };
    },
  };
}
