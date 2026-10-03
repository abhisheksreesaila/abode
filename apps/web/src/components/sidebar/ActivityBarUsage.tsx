import { useAtomValue } from "@effect/atom-react";
import { collectLimitAccounts } from "@t3tools/shared/usageLimits";
import { GaugeIcon } from "lucide-react";
import { memo, useMemo } from "react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { usePrimarySettings } from "../../hooks/useSettings";
import { cn } from "../../lib/utils";
import { environmentPresentations } from "../../state/presentation";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { formatUsageTooltip } from "./activityBar";
import { ActivityBarButton, CELL_CLASS } from "./ActivityBarButton";
import { accountTitle, UsageLimitsPanel } from "./SidebarUsageStatus";
import {
  compactWindowLabel,
  formatResetAbsolute,
  pickClosestWindow,
  usageTone,
  type UsageTone,
} from "./usageStatus";

const BADGE_TONE: Record<UsageTone, string> = {
  ok: "text-sidebar-muted-foreground",
  warn: "text-warning-foreground",
  critical: "text-destructive",
};

/**
 * The usage button of the activity bar (abode F-036): the gauge with the closest
 * limit's percent as a small badge. It reads the limits the server already
 * publishes and never polls.
 */
export const ActivityBarUsage = memo(function ActivityBarUsage({
  active,
  onOpenUsagePage,
}: {
  readonly active: boolean;
  readonly onOpenUsagePage: () => void;
}) {
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00Z`);
  const accounts = useMemo(() => collectLimitAccounts(presentations), [presentations]);
  const closest = useMemo(() => pickClosestWindow(accounts, now), [accounts, now]);
  const hasWindows = accounts.some((account) => account.limits.windows.length > 0);

  // Nothing reported yet: the button is the way to the usage page.
  if (!hasWindows) {
    return (
      <ActivityBarButton
        label="Usage"
        active={active}
        icon={<GaugeIcon />}
        data-testid="activity-bar-usage"
        onClick={onOpenUsagePage}
      />
    );
  }

  const tone = closest ? usageTone(closest.window.usedPercent) : "ok";
  const reset = closest?.window.resetsAt
    ? formatResetAbsolute(closest.window.resetsAt, now, timestampFormat)
    : null;
  const label = closest
    ? formatUsageTooltip({
        accountLabel: accountTitle(closest.account),
        usedPercent: closest.window.usedPercent,
        windowLabel: compactWindowLabel(closest.window),
        reset,
      })
    : "Usage limits";

  return (
    <Popover>
      <ActivityBarButton
        label={label}
        icon={
          <>
            <GaugeIcon />
            {closest ? (
              <span
                aria-hidden
                className={cn(
                  "absolute right-1 bottom-1 text-4xs leading-none font-semibold tabular-nums",
                  BADGE_TONE[tone],
                )}
              >
                {Math.round(closest.window.usedPercent)}
              </span>
            ) : null}
          </>
        }
        render={
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={
                  closest
                    ? `Usage limits, ${Math.round(closest.window.usedPercent)}% used`
                    : "Usage limits"
                }
                data-testid="activity-bar-usage"
                data-active={active}
                data-tone={tone}
                className={CELL_CLASS}
              />
            }
          />
        }
      />
      <PopoverPopup side="right" align="end" sideOffset={6} width="md" padding="compact">
        <UsageLimitsPanel
          accounts={accounts}
          now={now}
          timestampFormat={timestampFormat}
          onOpenUsagePage={onOpenUsagePage}
        />
      </PopoverPopup>
    </Popover>
  );
});
