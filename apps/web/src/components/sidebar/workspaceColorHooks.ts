import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { CSSProperties } from "react";

import { useClientSettings } from "../../hooks/useSettings";
import {
  deriveLogicalProjectKeyFromSettings,
  selectProjectGroupingSettings,
} from "../../logicalProject";
import { workspaceColorCss, workspaceTintCss } from "./workspaceColor";
import { useWorkspaceColorIndex } from "./workspaceColorStore";

export interface WorkspaceColorStyle {
  readonly color: string;
  readonly tint: string;
}

/**
 * Color and tint for the workspace a project belongs to, keyed by the same
 * logical project key the sidebar groups by, so a row, its threads and the
 * chat header always agree. Null when there is no project (yet).
 */
export function useProjectWorkspaceColor(
  project: Pick<
    EnvironmentProject,
    "environmentId" | "id" | "workspaceRoot" | "repositoryIdentity"
  > | null,
): WorkspaceColorStyle | null {
  const groupingSettings = useClientSettings(selectProjectGroupingSettings);
  const projectKey = project
    ? deriveLogicalProjectKeyFromSettings(project, groupingSettings)
    : null;
  return useWorkspaceColorStyle(projectKey);
}

export function useWorkspaceColorStyle(projectKey: string | null): WorkspaceColorStyle | null {
  const index = useWorkspaceColorIndex(projectKey);
  return index === null ? null : { color: workspaceColorCss(index), tint: workspaceTintCss(index) };
}

/** Inline style that feeds the row's 3px color bar (`--workspace-color`). */
export function workspaceBarStyle(color: WorkspaceColorStyle | null): CSSProperties | undefined {
  return color ? ({ "--workspace-color": color.color } as CSSProperties) : undefined;
}
