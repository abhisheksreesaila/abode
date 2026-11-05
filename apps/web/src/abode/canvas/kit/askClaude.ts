type AskClaudeAction =
  | { readonly kind: "disabled"; readonly reason: string }
  /** Already on the draft: the prompt is enough, a draft has no thread route. */
  | { readonly kind: "prompt" }
  /** A server thread (the open one, or the borrowed latest session): fill it and go there. */
  | { readonly kind: "prompt-and-open" };

export function askClaudeAction(input: {
  readonly hasThreadRef: boolean;
  readonly isDraft: boolean;
}): AskClaudeAction {
  if (!input.hasThreadRef) {
    return { kind: "disabled", reason: "Open a session first, then ask Claude from there." };
  }
  return input.isDraft ? { kind: "prompt" } : { kind: "prompt-and-open" };
}
