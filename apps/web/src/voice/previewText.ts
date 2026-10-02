const PREVIEW_MAX_CHARS = 150;

/** Keeps the newest words (the end of the text) so the preview follows the speaker. */
export function previewTail(text: string, maxChars = PREVIEW_MAX_CHARS): string {
  if (text.length <= maxChars) return text;
  const tail = text.slice(-maxChars);
  // Start at a word boundary when there is one, so no word is cut in half.
  const space = tail.indexOf(" ");
  const clean = space > 0 && space < 20 ? tail.slice(space + 1) : tail;
  return `…${clean.replace(/^…/, "")}`;
}

/** What the muted bubble shows: download progress until words arrive, then the newest words. */
export function previewLabel(input: { interim?: string; downloadProgress?: number }) {
  if (input.interim) return previewTail(input.interim);
  if (input.downloadProgress !== undefined && input.downloadProgress < 1) {
    return `Downloading voice model ${Math.round(input.downloadProgress * 100)}%…`;
  }
  return null;
}
