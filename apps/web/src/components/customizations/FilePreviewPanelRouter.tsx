import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { type ComponentProps, lazy, useEffect } from "react";

import { Button } from "~/components/ui/button";
import { useCustomizationEditorStore } from "~/customizationEditorStore";
import { useProject, useThreadShell } from "~/state/entities";
import { resolvePathLinkTarget } from "~/terminal-links";

import { findKnownCustomization, isCustomizationPath } from "./customizationsModel";

const FilePreviewPanel = lazy(() => import("../files/FilePreviewPanel"));

type FilePreviewPanelProps = ComponentProps<typeof FilePreviewPanel>;

/**
 * Claude customization files never edit in the side panel: this tab opens the big customization
 * editor (abode F-045), which owns saving, locking and validation, and leaves a way to reopen it.
 */
function OpenInCustomizationEditor(props: {
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
  readonly projectName: string;
  readonly path: string;
  readonly threadRef: ScopedThreadRef;
}) {
  const { environmentId, cwd, projectName, path, threadRef } = props;
  const openEditor = useCustomizationEditorStore((state) => state.openEditor);
  const open = () =>
    openEditor({
      scope: { environmentId, cwd, projectName, threadRef },
      target: { type: "edit", path },
    });
  useEffect(() => {
    openEditor({
      scope: { environmentId, cwd, projectName, threadRef },
      target: { type: "edit", path },
    });
  }, [cwd, environmentId, openEditor, path, projectName, threadRef]);
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-xs text-muted-foreground">
      <p>This customization file edits in the full editor.</p>
      <Button size="compact" variant="outline" onClick={open}>
        Open editor
      </Button>
    </div>
  );
}

/**
 * The side panel's file surface. Customization files (including ones outside the workspace, like
 * `~/.claude/...`) open in the big customization editor; every other file keeps the workspace
 * file panel.
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
        <OpenInCustomizationEditor
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
