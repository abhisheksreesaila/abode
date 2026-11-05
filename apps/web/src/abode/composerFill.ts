import { useComposerDraftStore } from "~/composerDraftStore";

type Target = Parameters<ReturnType<typeof useComposerDraftStore.getState>["setPrompt"]>[0];

/** An empty composer takes the text; one with a draft keeps it and gets the text on a new line. */
export function fillOrAppend(existing: string, text: string): string {
  return existing.trim() === "" ? text : `${existing.trimEnd()}\n${text}`;
}

/** Puts `text` in the thread's or draft's composer without sending, never overwriting a draft. */
export function fillComposer(target: Target, text: string): void {
  const store = useComposerDraftStore.getState();
  store.setPrompt(target, fillOrAppend(store.getComposerDraft(target)?.prompt ?? "", text));
}
