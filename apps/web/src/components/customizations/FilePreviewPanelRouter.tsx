import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { type ComponentProps, lazy } from "react";

import { useProject, useThreadShell } from "~/state/entities";
import { resolvePathLinkTarget } from "~/terminal-links";

import { findKnownCustomization, isCustomizationPath } from "./customizationsModel";

const FilePreviewPanel = lazy(() => import("../files/FilePreviewPanel"));
const CustomizationFilePanel = lazy(() => import("./CustomizationFilePanel"));

type FilePreviewPanelProps = ComponentProps<typeof FilePreviewPanel>;

/**
 * The side panel's file surface. Claude customization files (including ones
 * outside the workspace, like `~/.claude/...`) open in the customizations
 * editor, which reads and writes through the customizations RPCs. Every other
 * file keeps the workspace file panel.
 */
export default function FilePreviewPanelRouter(props: FilePreviewPanelProps) {
  const { attachment, cwd, relativePath } = props;
  // The panel's cwd may be a thread worktree; the server only knows the registered project root.
  const shell = useThreadShell(props.threadRef);
  const project = useProject(shell ? scopeProjectRef(shell.environmentId, shell.projectId) : null);
  const projectCwd = project?.workspaceRoot ?? cwd;
  if (attachment === undefined && relativePath !== null && cwd.length > 0) {
    const absolutePath = resolvePathLinkTarget(relativePath, cwd);
    if (
      findKnownCustomization(absolutePath) ||
      isCustomizationPath({ path: absolutePath, projectRoot: projectCwd, panelCwd: cwd })
    ) {
      return (
        <CustomizationFilePanel
          key={`${props.environmentId}:${absolutePath}`}
          environmentId={props.environmentId}
          cwd={projectCwd}
          path={absolutePath}
          threadRef={props.threadRef}
        />
      );
    }
  }
  return <FilePreviewPanel {...props} />;
}
