/** Word error rate helpers shared by bench.mjs and bench-long.mjs. */

// Identifiers split at camelCase ("useEffect" = "use effect"), and spoken numbers match digits.
export const normalize = (text) =>
  text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/\bt three\b/g, "t3")
    .replace(/\bthree thousand\b/g, "3000")
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

export function editDistance(ref, hyp) {
  let previous = Array.from({ length: hyp.length + 1 }, (_, i) => i);
  for (let i = 1; i <= ref.length; i++) {
    const row = [i];
    for (let j = 1; j <= hyp.length; j++) {
      row[j] = Math.min(
        previous[j] + 1,
        row[j - 1] + 1,
        previous[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1),
      );
    }
    previous = row;
  }
  return previous[hyp.length];
}
