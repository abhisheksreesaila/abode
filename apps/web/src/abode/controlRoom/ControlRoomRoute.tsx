import type { ReactNode } from "react";

import { useAllEnvironmentShellsBootstrapped, useProjects } from "~/state/entities";

import { ControlRoomView } from "./ControlRoomView";
import { controlRoomVisible } from "./controlRoomVisible";

/**
 * What "/" shows: the Control room when `controlRoomVisible`. Otherwise `fallback`
 * (upstream's landing: the no-projects hero).
 */
export function ControlRoomRoute(props: { readonly fallback: ReactNode }) {
  const projectCount = useProjects().length;
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  return controlRoomVisible({ bootstrapped, projectCount }) ? <ControlRoomView /> : props.fallback;
}

/**
 * What stays behind Settings and Usage when no thread or draft opened them (they
 * opened from "/"). Inert like upstream's background thread, and `contents` so the
 * wrapper does not disturb the sidebar layout.
 */
export function ControlRoomBackdrop(props: { readonly fallback: ReactNode }) {
  return (
    <div inert className="contents">
      <ControlRoomRoute fallback={props.fallback} />
    </div>
  );
}
