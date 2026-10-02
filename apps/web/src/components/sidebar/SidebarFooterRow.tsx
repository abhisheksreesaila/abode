import type { CSSProperties, ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/utils";

/** The footer's per-item hues, defined as `--icon-*` variables in index.css. */
export type FooterIconColor = "pr" | "usage" | "customizations" | "phone" | "settings";

interface SidebarFooterRowProps extends Omit<ComponentProps<"button">, "title"> {
  readonly color: FooterIconColor;
  readonly icon: ReactNode;
  readonly title: ReactNode;
  /** A second, fainter line under the title. */
  readonly subtitle?: ReactNode;
  /** Right-aligned value, e.g. a count. */
  readonly end?: ReactNode;
  /** Percent used, drawn as a thin meter under the subtitle. */
  readonly meter?:
    | { readonly percent: number; readonly label: string; readonly barClass?: string | undefined }
    | undefined;
}

/**
 * One list row of the sidebar footer (abode F-025): a colored icon, a
 * title with optional meter and subtitle, and an optional end value. Renders a
 * button, so it also works as a popover or tooltip trigger.
 */
export function SidebarFooterRow({
  color,
  icon,
  title,
  subtitle,
  end,
  meter,
  className,
  ...props
}: SidebarFooterRowProps) {
  const hue = `var(--icon-${color})`;
  const iconStyle: CSSProperties = { color: hue };
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex w-full min-w-0 min-h-[26px] cursor-pointer items-center gap-2 rounded-xs px-2 py-0.5 text-start outline-hidden ring-ring hover:bg-sidebar-row-hover focus-visible:ring-2 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-3.5"
        style={iconStyle}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium text-sidebar-foreground">{title}</span>
        {meter ? (
          <span
            role="progressbar"
            aria-label={meter.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(meter.percent)}
            className="my-1 h-[3px] overflow-hidden rounded-full bg-muted"
          >
            <span
              className={cn("block h-full rounded-full", meter.barClass)}
              style={{
                width: `${Math.min(100, Math.max(0, meter.percent))}%`,
                ...(meter.barClass ? {} : { backgroundColor: hue }),
              }}
            />
          </span>
        ) : null}
        {subtitle ? (
          <span className="truncate text-3xs text-secondary-label">{subtitle}</span>
        ) : null}
      </span>
      {end ? (
        <span className="shrink-0 text-3xs tabular-nums text-muted-foreground">{end}</span>
      ) : null}
    </button>
  );
}
