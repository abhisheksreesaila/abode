import { useAtomValue } from "@effect/atom-react";
import { collectLimitAccounts, type LimitAccount } from "@t3tools/shared/usageLimits";
import { GaugeIcon } from "lucide-react";
import { memo, useMemo } from "react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { usePrimarySettings } from "../../hooks/useSettings";
import { cn } from "../../lib/utils";
import { environmentPresentations } from "../../state/presentation";
import { getDriverOption } from "../settings/providerDriverMeta";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { SidebarFooterRow } from "./SidebarFooterRow";
import {
  compactWindowLabel,
  formatResetAbsolute,
  hasReset,
  pickClosestWindow,
  usageTone,
  windowRowLabel,
  type UsageTone,
} from "./usageStatus";

const TONE_TEXT: Record<UsageTone, string> = {
  ok: "text-foreground",
  warn: "text-warning-foreground",
  critical: "text-destructive",
};

const TONE_BAR: Record<UsageTone, string> = {
  ok: "bg-muted-foreground",
  warn: "bg-warning",
  critical: "bg-destructive",
};

function accountTitle(account: LimitAccount): string {
  const driver = getDriverOption(account.driver)?.label ?? String(account.driver);
  const name = account.displayName ?? driver;
  return account.plan ? `${name} ${account.plan}` : name;
}

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
                ? `${compactWindowLabel(closest.window)} ${Math.round(closest.window.usedPercent)}% used${reset ? ` · resets ${reset}` : ""}`
                : "Limits reset"
            }
            meter={
              closest
                ? {
                    percent: closest.window.usedPercent,
                    label: "Usage",
                    barClass: tone === "ok" ? undefined : TONE_BAR[tone],
                  }
                : undefined
            }
          />
        }
      />
      <PopoverPopup side="top" align="start" sideOffset={6} width="md" padding="compact">
        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={onOpenUsagePage}
            className="cursor-pointer self-start text-xs text-primary hover:underline"
          >
            Open usage page
          </button>
          {accounts.map((account) => (
            <section key={account.key} className="flex flex-col gap-2">
              <h4 className="text-xs font-medium text-foreground">{accountTitle(account)} usage</h4>
              {account.limits.windows.map((row) => {
                const passed = hasReset(row.resetsAt, now);
                const rowTone = passed ? "ok" : usageTone(row.usedPercent);
                const rowReset = row.resetsAt
                  ? formatResetAbsolute(row.resetsAt, now, timestampFormat)
                  : null;
                return (
                  <div key={row.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
                    <span className="truncate text-muted-foreground">{windowRowLabel(row)}</span>
                    {passed ? (
                      <span className="text-muted-foreground">reset</span>
                    ) : (
                      <span className={cn("font-medium tabular-nums", TONE_TEXT[rowTone])}>
                        {Math.round(row.usedPercent)}% used
                      </span>
                    )}
                    <span
                      role="progressbar"
                      aria-label={windowRowLabel(row)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={passed ? 0 : Math.round(row.usedPercent)}
                      className="col-span-2 h-1 overflow-hidden rounded-full bg-muted"
                    >
                      <span
                        className={cn("block h-full rounded-full", TONE_BAR[rowTone])}
                        style={{ width: `${passed ? 0 : row.usedPercent}%` }}
                      />
                    </span>
                    {rowReset ? (
                      <small className="col-span-2 text-muted-foreground">resets {rowReset}</small>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </PopoverPopup>
    </Popover>
  );
});
