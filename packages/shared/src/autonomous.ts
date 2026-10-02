/**
 * Autonomous mode vocabulary shared by the server (which sends the nudge and
 * reads the done marker) and the clients (which render the nudge compactly).
 * Everything rides inside ordinary user and assistant text, so the official
 * mobile app shows these turns as normal messages.
 */

/** The agent ends its final message with this when the task is complete. */
export const AUTONOMOUS_DONE_MARKER = "ABODE:DONE";

/** Auto-continue user turns open with `[abode:auto <count>/<cap>]`. */
export const AUTONOMOUS_CONTINUE_PREFIX = "[abode:auto";

const AUTO_CONTINUE_PATTERN = /^\[abode:auto (\d+)\/(\d+)\]/;

// Markdown emphasis, backticks, quotes and sentence punctuation may trail the marker.
const TRAILING_DECORATION = /[\s*_`'".!)\]]+$/;

export function endsWithAutonomousDoneMarker(text: string): boolean {
  return text.replace(TRAILING_DECORATION, "").endsWith(AUTONOMOUS_DONE_MARKER);
}

/** Parses an auto-continue user message; null for any other text. */
export function parseAutoContinueMessage(
  text: string,
): { readonly count: number; readonly cap: number } | null {
  const match = AUTO_CONTINUE_PATTERN.exec(text);
  if (match === null) return null;
  return { count: Number(match[1]), cap: Number(match[2]) };
}

export function formatAutoContinueLabel(count: number, cap: number): string {
  return `↻ auto-continue ${count}/${cap}`;
}
