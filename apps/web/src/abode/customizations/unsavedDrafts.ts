/**
 * Unsaved edits to a customization file, kept in memory only while the app runs. The side panel
 * shows one tab at a time and unmounts the others, so without this a switch to the Changes tab
 * would drop what was typed. `saved` is the text on disk when the edit began; a restored draft is
 * only offered if the file still matches it.
 */
export interface UnsavedDraftKey {
  readonly environmentId: string;
  readonly path: string;
}

export interface UnsavedDraft {
  readonly saved: string;
  readonly contents: string;
}

const drafts = new Map<string, UnsavedDraft>();

const keyOf = (key: UnsavedDraftKey) => `${key.environmentId}\u0000${key.path}`;

export function rememberUnsavedDraft(key: UnsavedDraftKey, draft: UnsavedDraft): void {
  if (draft.saved === draft.contents) drafts.delete(keyOf(key));
  else drafts.set(keyOf(key), draft);
}

export function readUnsavedDraft(key: UnsavedDraftKey): UnsavedDraft | null {
  return drafts.get(keyOf(key)) ?? null;
}

export function clearUnsavedDraft(key: UnsavedDraftKey): void {
  drafts.delete(keyOf(key));
}
