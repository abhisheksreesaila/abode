/**
 * What "/" shows: the room once shells are loaded and a project exists, nothing while
 * projects are still loading (upstream's landing would open a draft thread), else upstream's landing.
 */
export function controlRoomView(input: {
  readonly bootstrapped: boolean;
  readonly projectCount: number;
}): "room" | "wait" | "fallback" {
  if (input.projectCount === 0) return "fallback";
  return input.bootstrapped ? "room" : "wait";
}
