import { useRef, type KeyboardEvent, type PointerEvent } from "react";

import { cn } from "../../lib/utils";
import {
  CUSTOMIZATIONS_MAX_FRACTION,
  CUSTOMIZATIONS_MIN_FRACTION,
  fractionFromDrag,
  fractionFromKey,
} from "./customizationsHeight";

/**
 * The horizontal handle above the Customizations section (abode F-046). Drag up to grow the
 * section, down to shrink it; arrow keys step it, double-click resets.
 *
 * While dragging, pointer moves are coalesced to one `onPreview` per animation frame (the
 * parent writes the height straight to the element, so React does not re-render per frame);
 * `onCommit` fires once on release. Nothing runs between moves.
 */
export function CustomizationsResizeHandle({
  fraction,
  getContainerHeight,
  onPreview,
  onCommit,
  onReset,
}: {
  readonly fraction: number;
  readonly getContainerHeight: () => number;
  readonly onPreview: (fraction: number) => void;
  readonly onCommit: (fraction: number) => void;
  readonly onReset: () => void;
}) {
  const handleRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    startFraction: number;
    startY: number;
    containerHeight: number;
    latest: number;
    frame: number | null;
  } | null>(null);

  const announce = (value: number) =>
    handleRef.current?.setAttribute("aria-valuenow", String(Math.round(value * 100)));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startFraction: fraction,
      startY: event.clientY,
      containerHeight: getContainerHeight(),
      latest: fraction,
      frame: null,
    };
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    state.latest = fractionFromDrag({
      startFraction: state.startFraction,
      startY: state.startY,
      y: event.clientY,
      containerHeight: state.containerHeight,
    });
    if (state.frame === null) {
      state.frame = requestAnimationFrame(() => {
        state.frame = null;
        onPreview(state.latest);
        announce(state.latest);
      });
    }
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    if (state.frame !== null) cancelAnimationFrame(state.frame);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onCommit(state.latest);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = fractionFromKey(fraction, event.key);
    if (next === null) return;
    event.preventDefault();
    onCommit(next);
  };

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize Customizations"
      aria-valuemin={Math.round(CUSTOMIZATIONS_MIN_FRACTION * 100)}
      aria-valuemax={Math.round(CUSTOMIZATIONS_MAX_FRACTION * 100)}
      aria-valuenow={Math.round(fraction * 100)}
      tabIndex={0}
      data-testid="customizations-resize-handle"
      className={cn(
        "relative z-10 -mt-px h-[3px] shrink-0 cursor-row-resize touch-none select-none outline-hidden",
        "before:absolute before:inset-x-0 before:-top-1 before:-bottom-1 before:content-['']",
        "hover:bg-ring/60 focus-visible:bg-ring active:bg-ring",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
