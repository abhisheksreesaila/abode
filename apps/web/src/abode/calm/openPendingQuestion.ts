/**
 * Opens and focuses upstream's pending question or approval panel in this thread's composer.
 * Couples to upstream's `data-chat-composer-overlay`, `data-chat-composer-form`,
 * `data-pending-user-input-toggle` and `data-approval-detail`. False: no question shown yet.
 */
export function openPendingQuestion(root: HTMLElement | null): boolean {
  const overlay = root?.parentElement?.parentElement?.querySelector<HTMLElement>(
    "[data-chat-composer-overlay]",
  );
  const form = overlay?.querySelector<HTMLElement>('[data-chat-composer-form="true"]');
  if (!form) return false;
  form.querySelector<HTMLElement>('[data-pending-user-input-toggle="collapsed"]')?.click();
  form.scrollIntoView({ block: "nearest" });
  const target =
    form.querySelector<HTMLElement>("[data-pending-user-input-toggle]") ??
    form.querySelector<HTMLElement>("[data-approval-detail]");
  if (target) {
    target.focus();
    return true;
  }
  form.querySelector<HTMLElement>("[contenteditable='true'], textarea")?.focus();
  return false;
}
