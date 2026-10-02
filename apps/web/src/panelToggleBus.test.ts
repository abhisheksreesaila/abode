import { describe, expect, it, vi } from "vite-plus/test";

import {
  onPanelToggleRequest,
  readPersistedSidebarOpen,
  requestPanelToggle,
  SIDEBAR_OPEN_STORAGE_KEY,
  writePersistedSidebarOpen,
} from "./panelToggleBus";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe("sidebar open persistence", () => {
  it("defaults to open when nothing is stored or storage is unavailable", () => {
    expect(readPersistedSidebarOpen(memoryStorage())).toBe(true);
    expect(readPersistedSidebarOpen(null)).toBe(true);
    expect(
      readPersistedSidebarOpen({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(true);
  });

  it("restores a closed sidebar after a reload", () => {
    const storage = memoryStorage();
    writePersistedSidebarOpen(storage, false);
    expect(storage.getItem(SIDEBAR_OPEN_STORAGE_KEY)).toBe("false");
    expect(readPersistedSidebarOpen(storage)).toBe(false);
    writePersistedSidebarOpen(storage, true);
    expect(readPersistedSidebarOpen(storage)).toBe(true);
  });
});

describe("panel toggle requests", () => {
  it("only reaches the subscriber for that panel and stops after unsubscribe", () => {
    vi.stubGlobal("window", new EventTarget());
    const terminal = vi.fn();
    const sidebar = vi.fn();
    const offTerminal = onPanelToggleRequest("terminal", terminal);
    const offSidebar = onPanelToggleRequest("sidebar", sidebar);

    requestPanelToggle("terminal");
    expect(terminal).toHaveBeenCalledTimes(1);
    expect(sidebar).not.toHaveBeenCalled();

    offTerminal();
    offSidebar();
    requestPanelToggle("terminal");
    expect(terminal).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
