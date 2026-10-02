import { memo } from "react";

import { useNowMinute } from "../hooks/useNowMinute";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { greetingForHour, isCoffeeTime, isFridayShipTime, minuteToDate } from "./delights.logic";
import { useDelightsEnabled } from "./delightsSetting";

/**
 * The 3pm coffee for the status bar. It mounts when the window opens, so the
 * steam puff plays once then, and unmounts when it closes. The clock is the
 * shared minute clock, so this adds no timers.
 */
export const CoffeeStatus = memo(function CoffeeStatus() {
  const enabled = useDelightsEnabled();
  const nowMinute = useNowMinute();
  if (!enabled || !isCoffeeTime(minuteToDate(nowMinute))) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="relative inline-flex h-full shrink-0 items-center px-2"
            data-status-bar-coffee=""
          >
            <span aria-hidden className="delight-steam delight-steam-left" />
            <span aria-hidden className="delight-steam delight-steam-right" />
            <span role="img" aria-label="Coffee o'clock">
              ☕
            </span>
          </span>
        }
      />
      <TooltipPopup side="top">Coffee o'clock</TooltipPopup>
    </Tooltip>
  );
});

/** The one-time sparkle on the autonomous chip. Remount it (new key) to replay. */
export function DoneSparkle() {
  return (
    <span aria-hidden className="delight-sparkle absolute -top-1.5 -right-1 text-3xs leading-none">
      ✨
    </span>
  );
}

/** Greeting line above the project welcome title, by local time of day. */
export function useWelcomeGreeting(): string | null {
  const enabled = useDelightsEnabled();
  const nowMinute = useNowMinute();
  return enabled ? greetingForHour(minuteToDate(nowMinute).getHours()) : null;
}

/** True on Friday afternoons, with delights on. */
export function useFridayShipIt(): boolean {
  const enabled = useDelightsEnabled();
  const nowMinute = useNowMinute();
  return enabled && isFridayShipTime(minuteToDate(nowMinute));
}
