import { ABODE_NAME } from "../brand";
import { cn } from "../lib/utils";

/**
 * The lowercase abode wordmark. "ab" takes the surrounding foreground color and "ode" the
 * muted one, the same emphasis T3's wordmark gives "T3" over "Code".
 */
export function AbodeWordmark({
  className,
  mutedClassName,
}: {
  className?: string;
  mutedClassName?: string | undefined;
}) {
  return (
    <span
      aria-label={ABODE_NAME}
      className={cn("inline-flex items-baseline", className)}
      role="img"
    >
      <span aria-hidden className="font-semibold">
        ab
      </span>
      <span aria-hidden className={cn("text-muted-foreground", mutedClassName)}>
        ode
      </span>
    </span>
  );
}
