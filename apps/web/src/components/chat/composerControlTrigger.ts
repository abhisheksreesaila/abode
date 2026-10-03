interface ControlTriggerScope {
  closest(selector: string): ControlTriggerRoot | null;
}

interface ControlTriggerRoot {
  querySelectorAll(selector: string): ArrayLike<ControlTriggerElement>;
}

interface ControlTriggerElement {
  closest(selector: string): unknown;
  checkVisibility(options: { visibilityProperty: boolean }): boolean;
}

/**
 * The scope that holds every composer control: the stack wraps the glass shell
 * and the rows ChatView hosts above and below it, so the picker row and the
 * status row are searched along with the footer. Falls back to the shell.
 */
export function composerControlScope(form: ControlTriggerScope | null) {
  return (
    form?.closest("[data-chat-composer-stack]") ?? form?.closest('[data-slot="composer-shell"]')
  );
}

/**
 * The enabled, on-screen control that answers a `composer.*` command (its
 * `data-composer-shortcut` lists the commands), skipping controls hidden in an
 * inert block such as the resting strip's off-screen copy.
 */
export function findComposerControlTrigger<T extends ControlTriggerElement>(
  form: ControlTriggerScope | null,
  command: string,
): T | undefined {
  const scope = composerControlScope(form);
  return Array.from(
    (scope?.querySelectorAll(`button[data-composer-shortcut~="${command}"]:not(:disabled)`) ??
      []) as ArrayLike<T>,
  ).find(
    (element) =>
      !element.closest("[inert]") && element.checkVisibility({ visibilityProperty: true }),
  );
}
