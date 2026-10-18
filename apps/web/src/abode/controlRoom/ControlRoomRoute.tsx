import type { ReactNode } from "react";

import { useAllEnvironmentShellsBootstrapped, useProjects } from "~/state/entities";

import { ControlRoomView } from "./ControlRoomView";

/**
 * What "/" shows: the Control room once the shells are loaded and there is at least
 * one project. Otherwise `fallback` (upstream's landing: the no-projects hero).
 */
export function ControlRoomRoute(props: { readonly fallback: ReactNode }) {
  const projects = useProjects();
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  return bootstrapped && projects.length > 0 ? <ControlRoomView /> : props.fallback;
}
