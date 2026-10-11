/**
 * True when a key press starts inside the customization editor (`data-abode-editor`), so
 * app-wide shortcuts leave its keys to it: Ctrl+S saves the file instead of stashing the prompt.
 */
export function isAbodeEditorKeyEvent(event: KeyboardEvent): boolean {
  return event.target instanceof Element && event.target.closest("[data-abode-editor]") !== null;
}
