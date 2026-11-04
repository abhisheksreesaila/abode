/**
 * Keys in `next` that were not in `prev`. The first snapshot, and one that follows an empty list,
 * only seeds: a list that is still loading must not look like a run of new items.
 */
export function newKeys(prev: ReadonlyArray<string> | null, next: ReadonlyArray<string>): string[] {
  if (prev === null || prev.length === 0) return [];
  return next.filter((key) => !prev.includes(key));
}

/** How long the creation focus moment lasts (spec 5.11: the glow runs 1.6 to 1.8 seconds). */
export const FRESH_MS = 1800;
