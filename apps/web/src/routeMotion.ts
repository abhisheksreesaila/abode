import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";

import { useClientSettings } from "./hooks/useSettings";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { isSidebarUtilityPage } from "./components/sidebar/mainAppLocation";

/** abode's one-shot panel and route motion: 180ms ease-out, never looping. */
export const ABODE_MOTION_DURATION_MS = 180;

/**
 * The contract defaults the panel-motion setting to 0 ("off") and cannot change in this fork,
 * so a stored 0 means "use abode's default". Reduced motion is the off switch.
 */
export function resolveMotionDurationMs(settingMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return settingMs > 0 ? settingMs : ABODE_MOTION_DURATION_MS;
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
  const settingMs = useClientSettings((settings) => settings.panelAnimationDurationMs);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const previous = previousPathname;
    previousPathname = pathname;
    const durationMs = resolveMotionDurationMs(settingMs, reducedMotion);
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
