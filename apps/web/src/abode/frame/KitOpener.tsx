import { useEffect } from "react";

import { useStableCallback } from "~/hooks/useStableCallback";

import { useOpenKit } from "./useOpenKit";

const OPEN_KIT_EVENT = "abode:open-kit";

/** Asks the mounted `KitOpener` to open the Kit; for callers outside React, like palette rows. */
export function requestOpenKit(): void {
  window.dispatchEvent(new Event(OPEN_KIT_EVENT));
}

/** Opens the Kit when `requestOpenKit` fires. Mounted outside the sidebar, which the phone drawer unmounts. Renders nothing. */
export function KitOpener() {
  const openKit = useStableCallback(useOpenKit());
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes to a window event (outside React)
  useEffect(() => {
    const onOpen = () => void openKit();
    window.addEventListener(OPEN_KIT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_KIT_EVENT, onOpen);
  }, [openKit]);
  return null;
}
