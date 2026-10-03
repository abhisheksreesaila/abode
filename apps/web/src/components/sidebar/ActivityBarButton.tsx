import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export const CELL_CLASS =
  "relative flex size-12 shrink-0 cursor-pointer items-center justify-center text-sidebar-muted-foreground outline-hidden transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default disabled:opacity-40 disabled:hover:text-sidebar-muted-foreground data-[active=true]:text-white data-[active=true]:before:absolute data-[active=true]:before:inset-y-0 data-[active=true]:before:left-0 data-[active=true]:before:w-0.5 data-[active=true]:before:bg-primary [&>svg]:size-[22px]";

/** One 48x48 cell with a tooltip. `render` swaps the button, e.g. for the palette trigger. */
export function ActivityBarButton({
  label,
  active,
  icon,
  render,
  ...props
}: Omit<ComponentProps<"button">, "children" | "render"> & {
  readonly label: string;
  readonly active?: boolean;
  readonly icon: ReactNode;
  readonly render?: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          render ?? (
            <button
              type="button"
              aria-label={label}
              data-active={active === true}
              className={CELL_CLASS}
              {...props}
            />
          )
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipPopup side="right">{label}</TooltipPopup>
    </Tooltip>
  );
}
