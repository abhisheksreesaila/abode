/** Quieter than this reads as silence; louder than LOUD_DB is a full bar. */
const SILENT_DB = -50;
const LOUD_DB = -10;
/** Bars never vanish entirely, so the listening state stays visible in silence. */
const FLOOR = 0.15;
/** Five bars, tallest in the middle. */
const BAR_WEIGHTS = [0.55, 0.8, 1, 0.8, 0.55] as const;

/** 0..1 loudness of one audio buffer, on a decibel scale so normal speech moves the bars. */
export function levelOf(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  const rms = Math.sqrt(sum / samples.length);
  if (rms === 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - SILENT_DB) / (LOUD_DB - SILENT_DB)));
}

/** Bar heights (fractions of the full height) for a loudness level. */
export function waveHeights(level: number): number[] {
  return BAR_WEIGHTS.map((weight) => FLOOR + (1 - FLOOR) * level * weight);
}
