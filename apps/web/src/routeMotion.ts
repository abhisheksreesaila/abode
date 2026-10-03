import * as Schema from "effect/Schema";
import { useLayoutEffect } from "react";
import { useLocation } from "@tanstack/react-router";

import { useClientSettings } from "./hooks/useSettings";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { isSidebarUtilityPage } from "./components/sidebar/mainAppLocation";

/** abode's one-shot panel and route motion: ease-out, never looping. 0 means Off. */
export const ABODE_MOTION_DEFAULT_MS = 175;
export const ABODE_MOTION_MAX_MS = 400;
export const ABODE_MOTION_STORAGE_KEY = "abode:motion:v1";

/** Reduced motion always wins over the chosen duration. */
export function resolveMotionDurationMs(motionMs: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : motionMs;
}

/**
 * The first value: an upstream panel-animation duration someone already chose (> 0) carries
 * over; otherwise abode's default.
 */
export function seedMotionMs(legacyPanelAnimationMs: number): number {
  return legacyPanelAnimationMs > 0 ? legacyPanelAnimationMs : ABODE_MOTION_DEFAULT_MS;
}

/** The stored choice (client-only, never sent to a server), seeded once from the upstream setting. */
export function useAbodeMotionMs() {
  const legacyMs = useClientSettings((settings) => settings.panelAnimationDurationMs);
  return useLocalStorage(ABODE_MOTION_STORAGE_KEY, seedMotionMs(legacyMs), Schema.Int);
}

/** The one resolver behind every abode transition: stored choice, forced to 0 by reduced motion. */
export function useEffectiveMotionMs(): number {
  const [motionMs] = useAbodeMotionMs();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return resolveMotionDurationMs(motionMs, reducedMotion);
}

type RouteSection = "session" | "utility";

export function routeSection(pathname: string): RouteSection {
  return isSidebarUtilityPage(pathname) ? "utility" : "session";
}

/** Only crossing between a session and a utility page fades; moves within one stay still. */
export function shouldFadeRoute(previousPathname: string | null, pathname: string): boolean {
  return previousPathname !== null && routeSection(previousPathname) !== routeSection(pathname);
}

let previousPathname: string | null = null;

/**
 * Fades the main content (the sidebar inset) once when navigating between a session and a utility
 * page. Opacity only, on a compositor layer, via a single Web Animation that finishes by itself.
 */
export function useRouteSectionFade() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const durationMs = useEffectiveMotionMs();

  // Layout effect: the fade must start before the new page's first paint.
  useLayoutEffect(() => {
    const previous = previousPathname;
    previousPathname = pathname;
    if (durationMs === 0 || !shouldFadeRoute(previous, pathname)) return;
    const inset = document.querySelector<HTMLElement>("[data-slot='sidebar-inset']");
    if (!inset || typeof inset.animate !== "function") return;
    const animation = inset.animate([{ opacity: 0.35 }, { opacity: 1 }], {
      duration: durationMs,
      easing: "ease-out",
    });
    return () => animation.cancel();
    // Only a path change should start a fade, not a settings change.
  }, [pathname]);
}
