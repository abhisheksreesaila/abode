import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { AlertTriangleIcon, EyeIcon, LockIcon, LockOpenIcon, SaveIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { FileMarkdownPreview } from "~/components/files/FileMarkdownPreview";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { Toggle } from "~/components/ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { useAtomCommand } from "~/state/use-atom-command";

import {
  customizationScopeForPath,
  describeCustomizationsError,
  displayCustomizationPath,
  findKnownCustomization,
  resolveLocked,
} from "./customizationsModel";
import { customizationsEnvironment } from "./customizationsState";
import {
  canSave,
  changedOnDisk,
  cursorPosition,
  isSkillFile,
  keepMyEdits,
  resolveLoad,
  isDirty,
  languageForPath,
  validateCustomization,
} from "./editorModel";
import { useRefreshProviderSkills } from "./useRefreshProviderSkills";
import { clearUnsavedDraft, readUnsavedDraft, rememberUnsavedDraft } from "./unsavedDrafts";

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly readOnly: boolean };

/**
 * A customization file (a skill, agent, instructions or MCP file, in the workspace or under
 * `~/.claude`) edited in the right panel's file tab. It reads and writes through the
 * Customizations service, which enforces the allowed locations. User-wide files open locked.
 */
export function CustomizationFilePanel(props: {
  readonly environmentId: EnvironmentId;
  /** Registered project root: scopes the allowlist and tells workspace files from user ones. */
  readonly cwd: string;
  readonly projectName: string;
  readonly path: string;
  readonly threadRef: ScopedThreadRef;
}) {
  const { environmentId, cwd, projectName, path, threadRef } = props;
  const readFile = useAtomCommand(customizationsEnvironment.readFile, { reportFailure: false });
  const writeFile = useAtomCommand(customizationsEnvironment.writeFile, { reportFailure: false });
  const refreshSkills = useRefreshProviderSkills({
    environmentId,
    threadRef,
    workspaceRoot: cwd,
  });
  const draftKey = { environmentId, path };
  const known = findKnownCustomization(path);

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [saved, setSaved] = useState("");
  const [contents, setContents] = useState("");
  const [lockChoice, setLockChoice] = useState<boolean | undefined>(undefined);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  // Set when the disk text is not the text this editor holds: a stale draft on open, or a
  // changed file at save time. The person picks; nothing is overwritten or dropped silently.
  const [conflict, setConflict] = useState<{
    readonly kind: "draft" | "save";
    readonly onDisk: string;
    readonly mine: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readFile({ environmentId, input: { cwd, path } }).then((result) => {
      if (cancelled || isAtomCommandInterrupted(result)) return;
      if (result._tag === "Success") {
        const onDisk = result.value.contents;
        const draft = readUnsavedDraft(draftKey);
        const resolution = resolveLoad({ onDisk, draft });
        setSaved(onDisk);
        setContents(resolution === "restore" && draft ? draft.contents : onDisk);
        if (resolution === "restore") setLockChoice(false);
        if (resolution === "conflict" && draft) {
          setConflict({ kind: "draft", onDisk, mine: draft.contents });
          setLockChoice(false);
        }
        setLoad({ status: "ready", readOnly: result.value.readOnly });
        return;
      }
      setLoad({
        status: "error",
        message: describeCustomizationsError(squashAtomCommandFailure(result)),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [cwd, draftKey, environmentId, path, readFile]);

  const scope = known?.scope ?? customizationScopeForPath(path, cwd);
  const readOnly = load.status === "ready" ? load.readOnly : (known?.readOnly ?? false);
  const locked = resolveLocked({ scope, readOnly, choice: lockChoice });
  const dirty = load.status === "ready" && isDirty(saved, contents);
  const hints = load.status === "ready" ? validateCustomization({ path, contents }) : [];
  const isMarkdown = languageForPath(path) === "markdown";
  const display = displayCustomizationPath(path, cwd);

  const onChange = (next: string) => {
    setContents(next);
    rememberUnsavedDraft(draftKey, { saved, contents: next });
  };

  const write = async (toWrite: string) => {
    setSaving(true);
    setError(null);
    // No try/finally: the React Compiler skips any component that uses one.
    const run = async () => {
      const result = await writeFile({ environmentId, input: { cwd, path, contents: toWrite } });
      if (result._tag === "Success") {
        setSaved(toWrite);
        setConflict(null);
        clearUnsavedDraft(draftKey);
        toastManager.add(
          stackedThreadToast({
            type: "success",
            title: "Saved",
            description: display,
            timeout: 3500,
          }),
        );
        // The list reads names and descriptions out of the file, so refresh it after a save.
        appAtomRegistry.refresh(customizationsEnvironment.list({ environmentId, input: { cwd } }));
        if (isSkillFile(path)) refreshSkills();
        return;
      }
      if (isAtomCommandInterrupted(result)) return;
      const message = describeCustomizationsError(squashAtomCommandFailure(result));
      setError(message);
      toastManager.add(
        stackedThreadToast({ type: "error", title: "Couldn't save", description: message }),
      );
    };
    await run().finally(() => setSaving(false));
  };

  const save = async () => {
    if (!canSave({ dirty, locked, saving, creating: false, hasPlan: true }) || conflict) return;
    // Claude edits skills itself: look at the file again before replacing it.
    setSaving(true);
    const current = await readFile({ environmentId, input: { cwd, path } });
    setSaving(false);
    if (isAtomCommandInterrupted(current)) return;
    if (
      current._tag === "Success" &&
      changedOnDisk({ loaded: saved, onDisk: current.value.contents })
    ) {
      setConflict({ kind: "save", onDisk: current.value.contents, mine: contents });
      return;
    }
    await write(contents);
  };

  const loadDiskVersion = () => {
    if (!conflict) return;
    setSaved(conflict.onDisk);
    setContents(conflict.onDisk);
    clearUnsavedDraft(draftKey);
    setConflict(null);
  };
  const keepMine = () => {
    if (!conflict) return;
    if (conflict.kind === "save") {
      void write(conflict.mine);
      return;
    }
    // The draft stays; it is now an edit against the newer disk text.
    const next = keepMyEdits({ onDisk: conflict.onDisk, mine: conflict.mine });
    setSaved(next.saved);
    setContents(next.contents);
    rememberUnsavedDraft(draftKey, next);
    setConflict(null);
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="customization-file-panel"
      data-abode-editor=""
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
          event.preventDefault();
          void save();
        }
      }}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <span className="min-w-0 flex-1 truncate text-xs">
          {scope === "workspace" ? `${projectName} / ` : ""}
          {display}
        </span>
        {dirty ? (
          <span aria-label="Unsaved changes" className="size-2 shrink-0 rounded-full bg-warning" />
        ) : null}
        <Badge size="sm" variant={scope === "user" ? "info" : "secondary"}>
          {scope === "user" ? "user" : "workspace"}
        </Badge>
        {isMarkdown ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  size="xs"
                  pressed={preview}
                  onPressedChange={setPreview}
                  aria-label="Markdown preview"
                />
              }
            >
              <EyeIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup side="bottom">Preview</TooltipPopup>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                size="xs"
                pressed={locked}
                disabled={readOnly}
                onPressedChange={(next) => setLockChoice(next)}
                aria-label={locked ? "Unlock for editing" : "Lock (read-only)"}
              />
            }
          >
            {locked ? <LockIcon className="size-3.5" /> : <LockOpenIcon className="size-3.5" />}
          </TooltipTrigger>
          <TooltipPopup side="bottom">
            {readOnly
              ? "This file is read-only"
              : locked
                ? scope === "user"
                  ? "User-wide file: unlock to edit it for every workspace"
                  : "Locked: unlock to edit"
                : "Lock to make read-only"}
          </TooltipPopup>
        </Tooltip>
        <Button
          size="compact"
          variant="default"
          disabled={!canSave({ dirty, locked, saving, creating: false, hasPlan: true })}
          onClick={() => void save()}
        >
          {saving ? <Spinner size="sm" /> : <SaveIcon className="size-3.5" />}
          Save
        </Button>
      </div>

      {conflict ? (
        <div
          role="alert"
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 bg-warning/10 px-3 py-1.5 text-xs"
        >
          <span className="min-w-0 flex-1">
            {conflict.kind === "draft"
              ? "This file changed on disk since your unsaved edits."
              : "This file changed on disk since you opened it."}
          </span>
          <Button size="compact" variant="outline" onClick={keepMine}>
            {conflict.kind === "draft" ? "Keep my edits" : "Overwrite"}
          </Button>
          <Button size="compact" variant="outline" onClick={loadDiskVersion}>
            Load disk version
          </Button>
          {conflict.kind === "save" ? (
            <Button size="compact" variant="ghost" onClick={() => setConflict(null)}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}

      {load.status === "loading" ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Spinner size="sm" />
        </div>
      ) : load.status === "error" ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-destructive">
          {load.message}
        </div>
      ) : preview && isMarkdown ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <FileMarkdownPreview
            cwd={cwd}
            relativePath={path}
            text={contents}
            threadRef={threadRef}
            workspaceMutationId={null}
          />
        </div>
      ) : (
        <textarea
          value={contents}
          readOnly={locked || conflict !== null}
          spellCheck={false}
          aria-label={`Contents of ${display}`}
          onChange={(event) => onChange(event.target.value)}
          onSelect={(event) =>
            setCursor(cursorPosition(event.currentTarget.value, event.currentTarget.selectionStart))
          }
          className="min-h-0 flex-1 resize-none bg-background p-3 font-mono text-xs leading-5 text-foreground outline-hidden read-only:opacity-90"
        />
      )}

      <div className="flex min-h-7 shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-border/60 px-3 py-1 text-3xs text-muted-foreground">
        {hints.length > 0 ? (
          <span className="flex min-w-0 flex-1 items-center gap-1 text-warning-foreground">
            <AlertTriangleIcon className="size-3 shrink-0" />
            <span className="truncate">
              {hints[0]?.message}
              {hints.length > 1 ? ` (+${hints.length - 1} more)` : ""}
            </span>
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {error ? <span className="text-destructive">{error}</span> : null}
        <span className="tabular-nums">
          Ln {cursor.line}, Col {cursor.column}
        </span>
      </div>
    </div>
  );
}
