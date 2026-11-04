import { useEffect, useRef } from "react";

import { useSidebar } from "~/components/ui/sidebar";

import { useCanvasStore } from "./canvasStore";
import { sidebarAction } from "./sidebarFlag";

/** Hides the sidebar while One Window is on and brings it back when it goes off. Renders nothing. */
export function SidebarFlagSync() {
  const enabled = useCanvasStore((state) => state.enabled);
  const { open, setOpen, setOpenMobile } = useSidebar();
  const previous = useRef<boolean | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- drives the sidebar's open state, which lives in the sidebar provider's own store
  useEffect(() => {
    const action = sidebarAction({ prev: previous.current, next: enabled, open });
    previous.current = enabled;
    if (action === "collapse") {
      setOpen(false);
      setOpenMobile(false);
    } else if (action === "expand") setOpen(true);
  }, [enabled, open, setOpen, setOpenMobile]);
  return null;
}
