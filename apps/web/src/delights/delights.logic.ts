/**
 * Pure rules for abode's "little delights" (F-034). Every delight is gated by
 * the client setting and plays once; nothing here touches the DOM or a timer.
 */

import type { ThreadAutonomousState } from "@t3tools/contracts";

export const DELIGHTS_STORAGE_KEY = "abode:delights:v1";

/** useNowMinute is a UTC "YYYY-MM-DDTHH:MM" string; the rules use local time. */
export function minuteToDate(nowMinute: string): Date {
  return new Date(`${nowMinute}:00Z`);
}

/** 15:00 up to, not including, 15:30 local. */
export function isCoffeeTime(date: Date): boolean {
  return date.getHours() === 15 && date.getMinutes() < 30;
}

export function greetingForHour(hour: number): string {
  if (hour >= 23 || hour < 5) return "Burning the midnight oil? 🦉";
  if (hour < 12) return "Good morning ☀️";
  if (hour < 17) return "Good afternoon";
  return "Evening 🌙";
}

export function isFridayShipTime(date: Date): boolean {
  return date.getDay() === 5 && date.getHours() >= 15;
}

/** The Send button tooltip, or null to leave the button as it is. */
export function sendTooltip(date: Date, enabled: boolean): string | null {
  return enabled && isFridayShipTime(date) ? "Ship it 🚢" : null;
}

/** Default on: only an explicit `{"enabled":false}` turns delights off. */
export function parseDelightsEnabled(raw: string | null): boolean {
  if (raw === null) return true;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && "enabled" in value) {
      return value.enabled !== false;
    }
  } catch {
    // Unreadable value: fall through to the default.
  }
  return true;
}

export interface AutonomousSnapshot {
  readonly threadKey: string;
  readonly enabled: boolean;
  readonly count: number;
  readonly stopReason: string | null;
}

export function snapshotAutonomous(
  threadKey: string,
  state: Pick<ThreadAutonomousState, "enabled" | "count" | "stopReason"> | null | undefined,
): AutonomousSnapshot {
  return {
    threadKey,
    enabled: state?.enabled === true,
    count: state?.count ?? 0,
    stopReason: state?.stopReason ?? null,
  };
}

/**
 * A run finishing is the transition enabled -> stopped(done) on one thread, so
 * a thread that was already done when opened, or a switch between threads,
 * never celebrates, and a steady state cannot re-fire. `turns` counts the
 * first turn plus every auto-continue.
 */
export function detectAutonomousDone(
  previous: AutonomousSnapshot | null,
  next: AutonomousSnapshot,
): { readonly turns: number } | null {
  if (previous === null || previous.threadKey !== next.threadKey) return null;
  if (!previous.enabled || next.enabled || next.stopReason !== "done") return null;
  return { turns: next.count + 1 };
}
