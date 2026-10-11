import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { resolvePathLinkTarget } from "@t3tools/shared/fileLinks";
import type { ComponentProps } from "react";

import FilePreviewPanel from "~/components/files/FilePreviewPanel";
import { useProject, useThreadShell } from "~/state/entities";

import { findKnownCustomization, isCustomizationPath } from "./customizationsModel";
import { CustomizationFilePanel } from "./CustomizationFilePanel";

type FilePreviewPanelProps = ComponentProps<typeof FilePreviewPanel>;

/**
 * The side panel's file surface (the one hook in `ChatView`). Customization files, including
 * ones outside the workspace like `~/.claude/...` that upstream shows read-only, open in the
 * customization editor; every other file keeps upstream's file panel untouched.
 */
export default function FilePreviewPanelRouter(props: FilePreviewPanelProps) {
  const { attachment, cwd, relativePath } = props;
  // The panel's cwd may be a checkout copy; the server only knows the registered project root.
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
          projectName={project?.title ?? ""}
          path={absolutePath}
          threadRef={props.threadRef}
        />
      );
    }
  }
  return <FilePreviewPanel {...props} />;
}
