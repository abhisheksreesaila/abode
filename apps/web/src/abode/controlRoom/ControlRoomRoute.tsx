import type { ReactNode } from "react";

import { useAllEnvironmentShellsBootstrapped, useProjects } from "~/state/entities";

import { CanvasShell } from "../canvas/CanvasShell";
import { useCanvasStore } from "../canvas/canvasStore";
import { ControlRoomView } from "./ControlRoomView";
import { controlRoomView } from "./controlRoomVisible";

/**
 * What "/" shows; see `controlRoomView`. `fallback` is upstream's landing.
 */
export function ControlRoomRoute(props: { readonly fallback: ReactNode }) {
  const projectCount = useProjects().length;
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const canvas = useCanvasStore((state) => state.enabled);
  const view = controlRoomView({ bootstrapped, projectCount });
  if (view === "wait") return null;
  if (view === "fallback") return props.fallback;
  return canvas ? <CanvasShell /> : <ControlRoomView />;
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
