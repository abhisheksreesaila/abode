import type { ScopedThreadRef } from "@t3tools/contracts";

type ThreadContextMenuHandler = (
  threadRef: ScopedThreadRef,
  position: { x: number; y: number },
) => Promise<void>;

/**
 * Each project folder owns the thread context menu (it needs the folder's rename state and
 * project). The Automations and Pinned rows borrow the menu of the folder their thread lives
 * in, so every row of a thread offers the same actions (abode F-035).
 */
const handlersByProjectKey = new Map<string, ThreadContextMenuHandler>();

/** Registers a folder's menu under each of its member project keys; returns the unregister. */
export function registerThreadContextMenu(
  projectKeys: readonly string[],
  handler: ThreadContextMenuHandler,
): () => void {
  for (const key of projectKeys) handlersByProjectKey.set(key, handler);
  return () => {
    for (const key of projectKeys) {
      if (handlersByProjectKey.get(key) === handler) handlersByProjectKey.delete(key);
    }
  };
}

export function showRegisteredThreadContextMenu(
  projectKey: string,
  threadRef: ScopedThreadRef,
  position: { x: number; y: number },
): Promise<void> {
  return handlersByProjectKey.get(projectKey)?.(threadRef, position) ?? Promise.resolve();
}
