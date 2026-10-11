/**
 * Sizing for the sidebar's Customizations section (abode F-046). The height is a fraction of the
 * sidebar's height, so it survives window and sidebar resizes. `null` means "not set": the
 * section sizes itself to its content, up to its default cap.
 */
export const CUSTOMIZATIONS_HEIGHT_STORAGE_KEY = "abode:customizations-height:v1";
/** 0 is collapsed to just the header; the section never takes more than this share. */
export const CUSTOMIZATIONS_MIN_FRACTION = 0;
export const CUSTOMIZATIONS_MAX_FRACTION = 0.85;
export const CUSTOMIZATIONS_KEYBOARD_STEP = 0.04;

export function clampCustomizationsFraction(fraction: number): number {
  return Math.min(CUSTOMIZATIONS_MAX_FRACTION, Math.max(CUSTOMIZATIONS_MIN_FRACTION, fraction));
}

/** Reads a stored value, ignoring anything that is not a finite number. */
export function parseStoredCustomizationsFraction(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? clampCustomizationsFraction(value) : null;
}

/** Dragging the handle up (smaller y) grows the section. */
export function fractionFromDrag(input: {
  readonly startFraction: number;
  readonly startY: number;
  readonly y: number;
  readonly containerHeight: number;
}): number {
  if (input.containerHeight <= 0) return clampCustomizationsFraction(input.startFraction);
  return clampCustomizationsFraction(
    input.startFraction + (input.startY - input.y) / input.containerHeight,
  );
}

/** Arrow Up/Down step, Page Up/Down step by three, Home collapses and End opens fully. */
export function fractionFromKey(current: number, key: string): number | null {
  switch (key) {
    case "ArrowUp":
      return clampCustomizationsFraction(current + CUSTOMIZATIONS_KEYBOARD_STEP);
    case "ArrowDown":
      return clampCustomizationsFraction(current - CUSTOMIZATIONS_KEYBOARD_STEP);
    case "PageUp":
      return clampCustomizationsFraction(current + CUSTOMIZATIONS_KEYBOARD_STEP * 3);
    case "PageDown":
      return clampCustomizationsFraction(current - CUSTOMIZATIONS_KEYBOARD_STEP * 3);
    case "Home":
      return CUSTOMIZATIONS_MIN_FRACTION;
    case "End":
      return CUSTOMIZATIONS_MAX_FRACTION;
    default:
      return null;
  }
}

export function loadCustomizationsFraction(): number | null {
  try {
    return parseStoredCustomizationsFraction(
      window.localStorage.getItem(CUSTOMIZATIONS_HEIGHT_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function saveCustomizationsFraction(fraction: number | null): void {
  try {
    if (fraction === null) window.localStorage.removeItem(CUSTOMIZATIONS_HEIGHT_STORAGE_KEY);
    else window.localStorage.setItem(CUSTOMIZATIONS_HEIGHT_STORAGE_KEY, String(fraction));
  } catch {
    // Storage can be unavailable (private mode); the size just won't persist.
  }
}
