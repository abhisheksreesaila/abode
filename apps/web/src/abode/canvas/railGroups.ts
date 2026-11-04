import type { WorkspaceThreadState } from "../shell/workspaceList";
import { DEFAULT_MODE, type SessionMode } from "./sessionMode";

export type RailGroup = "need" | "jam" | "move" | "quiet";

const GROUP_ORDER: ReadonlyArray<RailGroup> = ["need", "jam", "move", "quiet"];

/** Pulls on the user (a question, an approval, a blocked run), else running, else quiet. Jam needs session modes (later). */
export function workspaceGroup(threads: ReadonlyArray<WorkspaceThreadState>): RailGroup {
  // A failed or usage-limited run counts as blocked (spec 4: need = blocked, waiting, irreversible).
  if (threads.some((thread) => thread.attention === "needs-you" || thread.failed)) return "need";
  if (threads.some((thread) => thread.attention === "running")) return "move";
  return "quiet";
}

/** Up to two letters for a rail tile: first letters of the first two words, else the first two letters. */
export function workspaceInitials(name: string): string {
  const words = name.split(/[\s\-_./]+/).filter((word) => word.length > 0);
  const [first, second] = words;
  if (first === undefined) return "?";
  const letters = second === undefined ? first.slice(0, 2) : `${first[0]}${second[0]}`;
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
}

/** Rail order: need, jam, move, quiet; the given order holds inside a group. */
export function groupRailItems<T extends { readonly group: RailGroup }>(
  items: ReadonlyArray<T>,
): T[] {
  return GROUP_ORDER.flatMap((group) => items.filter((item) => item.group === group));
}

/** A session in Jam moves its workspace into the jam group; needing the user still comes first. */
export function withJam(group: RailGroup, liveModes: ReadonlyArray<SessionMode>): RailGroup {
  return group !== "need" && liveModes.includes("jam") ? "jam" : group;
}

const MODE_LEAD: ReadonlyArray<SessionMode> = ["jam", "grill", "tell", "auto"];

/** The mode shown on a workspace's rail badge: the most hands-on mode among its live sessions. */
export function workspaceMode(liveModes: ReadonlyArray<SessionMode>): SessionMode {
  return MODE_LEAD.find((mode) => liveModes.includes(mode)) ?? DEFAULT_MODE;
}
