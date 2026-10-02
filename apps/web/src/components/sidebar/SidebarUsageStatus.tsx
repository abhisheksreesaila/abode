import { useAtomValue } from "@effect/atom-react";
import { collectLimitAccounts, type LimitAccount } from "@t3tools/shared/usageLimits";
import { memo, useMemo } from "react";

import { usePrimarySettings } from "../../hooks/useSettings";
import { cn } from "../../lib/utils";
import { environmentPresentations } from "../../state/presentation";
import { getDriverOption } from "../settings/providerDriverMeta";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import {
  compactWindowLabel,
  formatResetAbsolute,
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
  return account.plan ? `${driver} ${account.plan}` : driver;
}

/**
 * The limit closest to running out, as one line at the foot of the sidebar,
 * with every window of every reporting account in a popover. It reads the
 * limits the server already publishes and never polls: the numbers move when
 * a turn or an explicit probe refreshes them.
 */
export const SidebarUsageStatus = memo(function SidebarUsageStatus() {
  const presentations = useAtomValue(environmentPresentations.presentationsAtom);
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const hour12 = timestampFormat === "locale" ? undefined : timestampFormat === "12-hour";
  const accounts = useMemo(() => collectLimitAccounts(presentations), [presentations]);
  const closest = useMemo(() => pickClosestWindow(accounts), [accounts]);
  // Reset times are absolute, so `now` only decides "today" versus a weekday;
  // it is taken when the limits change rather than on a clock.
  // oxlint-disable-next-line react/purity, react/memo-dependencies
  const now = useMemo(() => Date.now(), [accounts]);
  if (!closest) return null;

  const { window } = closest;
  const percent = Math.round(window.usedPercent);
  const tone = usageTone(window.usedPercent);
  const reset = window.resetsAt ? formatResetAbsolute(window.resetsAt, now, hour12) : null;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Usage limits"
            data-tone={tone}
            className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-start text-xs text-muted-foreground outline-hidden ring-ring hover:bg-accent focus-visible:ring-2"
          />
        }
      >
        <span className="truncate">
          {accountTitle(closest.account)} ·{" "}
          <span className={cn("font-medium tabular-nums", TONE_TEXT[tone])}>
            {compactWindowLabel(window)} {percent}%
          </span>
          {reset ? ` · resets ${reset}` : null}
        </span>
      </PopoverTrigger>
      <PopoverPopup side="top" align="start" sideOffset={6} width="md" padding="compact">
        <div className="flex w-full flex-col gap-3">
          {accounts.map((account) => (
            <section key={account.key} className="flex flex-col gap-2">
              <h4 className="text-xs font-medium text-foreground">{accountTitle(account)} usage</h4>
              {account.limits.windows.map((row) => {
                const rowTone = usageTone(row.usedPercent);
                const rowReset = row.resetsAt
                  ? formatResetAbsolute(row.resetsAt, now, hour12)
                  : null;
                return (
                  <div key={row.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
                    <span className="truncate text-muted-foreground">{windowRowLabel(row)}</span>
                    <span className={cn("font-medium tabular-nums", TONE_TEXT[rowTone])}>
                      {Math.round(row.usedPercent)}%
                    </span>
                    <span
                      role="progressbar"
                      aria-label={windowRowLabel(row)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(row.usedPercent)}
                      className="col-span-2 h-1 overflow-hidden rounded-full bg-muted"
                    >
                      <span
                        className={cn("block h-full rounded-full", TONE_BAR[rowTone])}
                        style={{ width: `${row.usedPercent}%` }}
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
