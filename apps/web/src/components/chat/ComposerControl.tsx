import { mergeProps } from "@base-ui/react/merge-props";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { useRender } from "@base-ui/react/use-render";
import type { ComponentProps, ComponentType, SVGProps } from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { Separator } from "../ui/separator";
import { CHIP_TINT_CLASS_NAMES, plainTintClassName, type ChipTint } from "./chipTint";

export type ComposerControlSize = "sm" | "xs";

/**
 * `plain` drops the box, border and background so the control reads as small
 * muted text, the look of the status row under the composer. Tints keep only
 * their text color there (see `plainTintClassName`).
 */
export type ComposerControlLook = "default" | "plain";

/** Overrides layered on the shared base classes; `default` adds nothing. */
const LOOK_CLASS_NAMES: Record<ComposerControlLook, string> = {
  default: "",
  plain:
    "h-6 gap-1 border-transparent bg-transparent px-1 font-normal text-muted-foreground/80 text-xs hover:bg-transparent hover:text-foreground aria-pressed:bg-transparent aria-pressed:text-foreground sm:h-6 sm:text-xs [&_svg:not([class*='size-'])]:size-3",
};

/** The tint classes for a look: full chip colors by default, text color only when plain. */
export function composerTintClassName(look: ComposerControlLook, tint: ChipTint): string {
  return look === "plain" ? plainTintClassName(tint) : CHIP_TINT_CLASS_NAMES[tint];
}

/**
 * The composer toolbar's control look. `sm` is the expanded toolbar; `xs` is the dimmer resting
 * strip. `aria-pressed` marks a toggle that is on (plan mode). This is an app control, not a
 * restyled Button, so it owns its classes.
 */
function composerControlClassName(
  size: ComposerControlSize,
  className?: string,
  look?: {
    chip?: boolean | undefined;
    tint?: ChipTint | undefined;
    look?: ComposerControlLook | undefined;
  },
) {
  const variant = look?.look ?? "default";
  return cn(
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-(--control-radius) border border-transparent text-base outline-none hover:bg-accent data-pressed:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 data-disabled:pointer-events-none data-disabled:opacity-64 pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 [&:active:not([aria-haspopup])]:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:-mx-0.5 [&_svg[data-composer-control-icon]]:mx-0",
    size === "xs"
      ? "h-7 gap-1 px-1.75 font-normal text-muted-foreground/70 text-sm hover:text-foreground/80 sm:h-6 sm:text-xs [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5 [&_svg[data-composer-control-chevron]]:ms-0 [&_svg[data-composer-control-chevron]]:-me-1"
      : "h-7 gap-1.5 px-2.5 font-medium text-secondary-label [&_svg:not([class*='text-'])]:text-muted-foreground hover:text-foreground sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4",
    "aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:hover:bg-accent/80",
    variant === "default" && look?.chip && "border-border/70 bg-input/40",
    look?.tint && composerTintClassName(variant, look.tint),
    LOOK_CLASS_NAMES[variant],
    className,
  );
}

type ComposerControlProps = useRender.ComponentProps<"button"> & {
  size?: ComposerControlSize;
  /** Outlined, input-tinted look for the composer's picker row. */
  chip?: boolean | undefined;
  /** Semantic or provider tint (chipTint.ts); overrides `chip`'s colors when both are set. */
  tint?: ChipTint | undefined;
  look?: ComposerControlLook | undefined;
};

export function ComposerControl({
  className,
  size = "sm",
  chip,
  tint,
  look,
  render,
  ...props
}: ComposerControlProps) {
  const defaultProps = {
    className: composerControlClassName(size, className, { chip, tint, look }),
    type: render ? undefined : ("button" as const),
  };
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

export function ComposerControlIcon({
  icon: Icon,
  className,
  opticalSize = "default",
  size = "sm",
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  className?: string | undefined;
  opticalSize?: "default" | "large";
  size?: ComposerControlSize;
}) {
  return (
    <Icon
      aria-hidden="true"
      className={cn(
        "shrink-0",
        size === "xs" ? "size-3" : opticalSize === "large" ? "size-4.5" : "size-4",
        className,
      )}
      data-composer-control-icon
    />
  );
}

export function ComposerControlChevron({
  className,
  size = "sm",
}: {
  className?: string;
  size?: ComposerControlSize;
} = {}) {
  return (
    <ChevronDownIcon
      aria-hidden="true"
      className={cn(
        "shrink-0",
        size === "xs" ? "size-3 text-current opacity-50" : "size-3.5 text-icon-muted",
        className,
      )}
      data-composer-control-chevron
      strokeWidth={2.25}
    />
  );
}

export function ComposerControlSeparator({
  className,
  size = "sm",
  ...props
}: Omit<ComponentProps<typeof Separator>, "orientation"> & {
  size?: ComposerControlSize;
}) {
  return (
    <Separator
      orientation="vertical"
      className={cn("mx-0.5 hidden sm:block", size === "xs" ? "h-3.5!" : "h-4", className)}
      {...props}
    />
  );
}

export function ComposerSelectControl({
  className,
  children,
  size = "sm",
  tint,
  look,
  ...props
}: Omit<SelectPrimitive.Trigger.Props, "className"> & {
  className?: string | undefined;
  size?: ComposerControlSize;
  tint?: ChipTint | undefined;
  look?: ComposerControlLook | undefined;
}) {
  return (
    <SelectPrimitive.Trigger
      className={composerControlClassName(size, className, { tint, look })}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ComposerControlChevron size={size} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}
