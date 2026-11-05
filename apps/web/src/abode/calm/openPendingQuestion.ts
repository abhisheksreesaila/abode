const PENDING_TARGET = "[data-pending-user-input-toggle], [data-approval-detail]";

function composerOverlay(root: HTMLElement | null): HTMLElement | null {
  return (
    root?.parentElement?.parentElement?.querySelector<HTMLElement>(
      "[data-chat-composer-overlay]",
    ) ?? null
  );
}

/**
 * Opens and focuses upstream's pending question or approval panel in this thread's composer.
 * Couples to upstream's `data-chat-composer-overlay`, `data-chat-composer-form`,
 * `data-pending-user-input-toggle` and `data-approval-detail`. With `focusComposerFallback`
 * off, nothing is focused unless the panel is there; false means it was not.
 */
export function openPendingQuestion(
  root: HTMLElement | null,
  options: { readonly focusComposerFallback?: boolean } = {},
): boolean {
  const form = composerOverlay(root)?.querySelector<HTMLElement>(
    '[data-chat-composer-form="true"]',
  );
  if (!form) return false;
  const target = form.querySelector<HTMLElement>(PENDING_TARGET);
  if (!target) {
    if (options.focusComposerFallback ?? true) {
      form.querySelector<HTMLElement>("[contenteditable='true'], textarea")?.focus();
    }
    return false;
  }
  form.querySelector<HTMLElement>('[data-pending-user-input-toggle="collapsed"]')?.click();
  form.scrollIntoView({ block: "nearest" });
  (form.querySelector<HTMLElement>("[data-pending-user-input-toggle]") ?? target).focus();
  return true;
}

/**
 * Opens the pending question as soon as the composer renders it, watching the composer for
 * changes instead of polling. Returns the stop function; it also stops itself on success.
 */
export function watchPendingQuestion(root: HTMLElement | null, onOpened: () => void): () => void {
  const attempt = () => {
    if (!openPendingQuestion(root, { focusComposerFallback: false })) return false;
    onOpened();
    return true;
  };
  if (attempt()) return () => {};
  const overlay = composerOverlay(root);
  if (!overlay) return () => {};
  const observer = new MutationObserver(() => {
    if (attempt()) observer.disconnect();
  });
  observer.observe(overlay, { childList: true, subtree: true });
  return () => observer.disconnect();
}
