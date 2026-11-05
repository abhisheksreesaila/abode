import { useRouter } from "@tanstack/react-router";

import { useCanvasStore } from "./canvasStore";
import "./back.css";

/** One Window's way back from a full chat. Mounted from ChatView's existing CalmTable hook, so only chat routes see it. */
export function BackToCanvas() {
  const enabled = useCanvasStore((state) => state.enabled);
  const router = useRouter();
  if (!enabled) return null;
  return (
    <button
      type="button"
      data-cv-back=""
      aria-label="Back to One window"
      onClick={() => void router.navigate({ to: "/" })}
    >
      ←<span data-cv-back-label=""> One window</span>
    </button>
  );
}
