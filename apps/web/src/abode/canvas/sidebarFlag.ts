export type SidebarAction = "collapse" | "expand" | "none";

/** What One Window does to the sidebar. `prev` is null on load; only flag changes act afterwards. */
export function sidebarAction(input: {
  readonly prev: boolean | null;
  readonly next: boolean;
  readonly open: boolean;
}): SidebarAction {
  const { prev, next, open } = input;
  if (prev === null) return next && open ? "collapse" : "none";
  if (prev === next) return "none";
  return next ? "collapse" : "expand";
}
