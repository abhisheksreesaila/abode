import type { TimestampFormat } from "@t3tools/contracts/settings";
import type { LimitAccount } from "@t3tools/shared/usageLimits";

import { cn } from "../../lib/utils";
import { getDriverOption } from "../settings/providerDriverMeta";
import {
  formatResetAbsolute,
  hasReset,
  usageTone,
  windowRowLabel,
  type UsageTone,
} from "../sidebar/usageStatus";

export const USAGE_TONE_TEXT: Record<UsageTone, string> = {
  ok: "text-foreground",
  warn: "text-warning-foreground",
  critical: "text-destructive",
};

export const USAGE_TONE_BAR: Record<UsageTone, string> = {
  ok: "bg-muted-foreground",
  warn: "bg-warning",
  critical: "bg-destructive",
};

export function accountTitle(account: LimitAccount): string {
  const driver = getDriverOption(account.driver)?.label ?? String(account.driver);
  const name = account.displayName ?? driver;
  return account.plan ? `${name} ${account.plan}` : name;
}

/** Every window of every reporting account, with a link to the usage page. */
export function UsageLimitsPanel({
  accounts,
  now,
  timestampFormat,
  onOpenUsagePage,
}: {
  readonly accounts: readonly LimitAccount[];
  readonly now: number;
  readonly timestampFormat: TimestampFormat;
  readonly onOpenUsagePage: () => void;
}) {
  return (
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
                  <span className={cn("font-medium tabular-nums", USAGE_TONE_TEXT[rowTone])}>
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
                    className={cn("block h-full rounded-full", USAGE_TONE_BAR[rowTone])}
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
  );
}
