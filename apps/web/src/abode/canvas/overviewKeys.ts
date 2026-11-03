export interface KeyLike {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly defaultPrevented: boolean;
  readonly typing: boolean;
}

/** `o` toggles (not while typing or with a modifier); Esc closes only the top-most layer. */
export function overviewKeyAction(
  event: KeyLike,
  state: { readonly open: boolean; readonly layerOpen: boolean },
): "toggle" | "close" | null {
  if (event.defaultPrevented) return null;
  if (event.key === "Escape") return state.open && !state.layerOpen ? "close" : null;
  if (event.key === "o" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.typing) {
    return "toggle";
  }
  return null;
}

/** A dialog, menu or popup is open above the overview. */
export function isLayerOpen(): boolean {
  return (
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], [role="menu"], [data-popup-open], [data-open][data-base-ui-popup]',
    ) !== null
  );
}
