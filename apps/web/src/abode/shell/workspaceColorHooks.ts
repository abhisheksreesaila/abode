import { workspaceColorCss, workspaceTintCss } from "./workspaceColor";
import { useWorkspaceColorIndex } from "./workspaceColorStore";

export interface WorkspaceColorStyle {
  readonly color: string;
  readonly tint: string;
}

/**
 * Color and tint for a workspace, keyed by the sidebar's logical project key so
 * a row, its sessions and anything else that shows the workspace agree.
 */
export function useWorkspaceColorStyle(projectKey: string | null): WorkspaceColorStyle | null {
  const index = useWorkspaceColorIndex(projectKey);
  return index === null ? null : { color: workspaceColorCss(index), tint: workspaceTintCss(index) };
}
