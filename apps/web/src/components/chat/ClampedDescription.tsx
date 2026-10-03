import { useRef, useState, type ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/** True when text was cut by a line clamp (its content is taller than its box). */
export function isTextClamped(box: { scrollHeight: number; clientHeight: number }): boolean {
  return box.scrollHeight > box.clientHeight + 1;
}

/**
 * Picker descriptions clamp to two lines. The full text appears in a tooltip
 * only when something was actually cut, measured on hover so a short
 * description never shows a tooltip that repeats it.
 */
export function ClampedDescription(props: {
  readonly children: string;
  readonly className?: string;
  readonly tooltipSide?: "top" | "right" | "bottom" | "left";
}): ReactNode {
  const ref = useRef<HTMLSpanElement>(null);
  const [clamped, setClamped] = useState(false);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            ref={ref}
            className={cn("line-clamp-2", props.className)}
            onPointerEnter={() => {
              if (ref.current) setClamped(isTextClamped(ref.current));
            }}
          />
        }
      >
        {props.children}
      </TooltipTrigger>
      {clamped ? (
        <TooltipPopup side={props.tooltipSide ?? "right"}>{props.children}</TooltipPopup>
      ) : null}
    </Tooltip>
  );
}
