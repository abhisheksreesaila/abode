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

/** Reload and close prompt while an edit would be lost; there is no upstream hook for in-app closes. */
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (drafts.size === 0) return;
  event.preventDefault();
  event.returnValue = "";
}

function syncUnloadGuard() {
  if (typeof window === "undefined") return;
  // Adding the same listener twice is a no-op, so this is safe to call after every change.
  if (drafts.size > 0) window.addEventListener("beforeunload", warnBeforeUnload);
  else window.removeEventListener("beforeunload", warnBeforeUnload);
}

export function hasUnsavedDrafts(): boolean {
  return drafts.size > 0;
}

export function rememberUnsavedDraft(key: UnsavedDraftKey, draft: UnsavedDraft): void {
  if (draft.saved === draft.contents) drafts.delete(keyOf(key));
  else drafts.set(keyOf(key), draft);
  syncUnloadGuard();
}

export function readUnsavedDraft(key: UnsavedDraftKey): UnsavedDraft | null {
  return drafts.get(keyOf(key)) ?? null;
}

export function clearUnsavedDraft(key: UnsavedDraftKey): void {
  drafts.delete(keyOf(key));
  syncUnloadGuard();
}
