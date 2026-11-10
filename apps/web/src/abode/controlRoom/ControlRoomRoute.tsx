import type { ReactNode } from "react";

import { useAllEnvironmentShellsBootstrapped, useProjects } from "~/state/entities";

import { CanvasShell } from "../canvas/CanvasShell";
import { useCanvasStore } from "../canvas/canvasStore";
import { controlRoomVisible } from "./controlRoomVisible";

/** What "/" shows: One window's overview when it is on, otherwise `fallback` (upstream's own "/"). */
export function ControlRoomRoute(props: { readonly fallback: ReactNode }) {
  const projectCount = useProjects().length;
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const canvas = useCanvasStore((state) => state.enabled);
  if (!canvas || !controlRoomVisible({ bootstrapped, projectCount })) return props.fallback;
  return <CanvasShell />;
}

/**
 * What stays behind Settings and Usage when no thread or draft opened them (they
 * e.g. from "/", Pull requests, or a direct /settings load). Inert like upstream's background thread, and `contents` so the
 * wrapper does not disturb the sidebar layout.
 */
export function ControlRoomBackdrop(props: { readonly fallback: ReactNode }) {
  return (
    <div inert className="contents">
      <ControlRoomRoute fallback={props.fallback} />
    </div>
  );
}
