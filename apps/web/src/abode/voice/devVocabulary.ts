/**
 * Developer words the speech model hears as ordinary English ("work tree", "Pixie", "sq. light").
 * Applied to every transcript. Only unambiguous cases belong here: each rule must be a phrase that
 * is almost never what a person means in a prompt to a coding agent. Measured in
 * docs/research/voice-spike.md.
 */
const RULES: ReadonlyArray<readonly [RegExp, string | ((...match: string[]) => string)]> = [
  [/\bwork trees\b/gi, "worktrees"],
  [/\bwork tree\b/gi, "worktree"],
  [/\bweb sockets\b/gi, "websockets"],
  [/\bweb socket\b/gi, "websocket"],
  [/\bpixie\b/gi, "pixi"],
  [/\bsq\.?\s*(?:light|lite)\b/gi, "SQLite"],
  [/\bsequel\s*lite\b/gi, "SQLite"],
  [/\bf\.?h\.?\s*(?:saas|sass|saws|sawz|sauce)\b/gi, "fh-saas"],
  [/\ba bode next\b/gi, "abode next"],
  [/\ba bode\b/gi, "abode"],
  [/\bt three\b/gi, "T3"],
  [
    /\buse (effect|memo|callback)\b/gi,
    (_all, hook) => `use${hook.charAt(0).toUpperCase()}${hook.slice(1).toLowerCase()}`,
  ],
];

export function applyDevVocabulary(text: string): string {
  let result = text;
  for (const [pattern, replacement] of RULES) {
    result = result.replace(pattern, replacement as string);
  }
  return result;
}
