import { useAtomValue } from "@effect/atom-react";
import { collectLimitAccounts } from "@t3tools/shared/usageLimits";
import { GaugeIcon } from "lucide-react";
import { memo, useMemo } from "react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { usePrimarySettings } from "../../hooks/useSettings";
import { environmentPresentations } from "../../state/presentation";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { accountTitle, UsageLimitsPanel, USAGE_TONE_BAR } from "../usage/UsageLimitsPanel";
import { SidebarFooterRow } from "./SidebarFooterRow";
import {
  compactWindowLabel,
  formatResetAbsolute,
  pickClosestWindow,
  usageTone,
} from "./usageStatus";

/**
 * The limit closest to running out, as a row at the foot of the sidebar,
 * with every window of every reporting account in a popover. It reads the
 * limits the server already publishes and never polls: the numbers move when
 * a turn or an explicit probe refreshes them.
 */
export const SidebarUsageStatus = memo(function SidebarUsageStatus({
  onOpenUsagePage,
}: {
  readonly onOpenUsagePage: () => void;
}) {
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00Z`);
  const accounts = useMemo(() => collectLimitAccounts(presentations), [presentations]);
  const closest = useMemo(() => pickClosestWindow(accounts, now), [accounts, now]);
  const hasWindows = accounts.some((account) => account.limits.windows.length > 0);
  // Nothing reported yet: the row stays as the way to the usage page.
  if (!hasWindows) {
    return (
      <SidebarFooterRow
        color="usage"
        icon={<GaugeIcon />}
        title="Usage"
        onClick={onOpenUsagePage}
      />
    );
  }

  // With nothing live left to rank, the item stays so the popover is still reachable.
  const tone = closest ? usageTone(closest.window.usedPercent) : "ok";
  const reset = closest?.window.resetsAt
    ? formatResetAbsolute(closest.window.resetsAt, now, timestampFormat)
    : null;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <SidebarFooterRow
            aria-label="Usage limits"
            data-tone={tone}
            color="usage"
            icon={<GaugeIcon />}
            title={closest ? accountTitle(closest.account) : "Usage"}
            subtitle={
              closest
                ? `${Math.round(closest.window.usedPercent)}% of ${compactWindowLabel(closest.window)}${reset ? ` · resets ${reset}` : ""}`
                : "Limits reset"
            }
            meter={
              closest
                ? {
                    percent: closest.window.usedPercent,
                    label: "Usage",
                    barClass: tone === "ok" ? "bg-primary" : USAGE_TONE_BAR[tone],
                  }
                : undefined
            }
          />
        }
      />
      <PopoverPopup side="top" align="start" sideOffset={6} width="md" padding="compact">
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
