import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { AlertTriangleIcon, EyeIcon, LockIcon, LockOpenIcon, SaveIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  cursorPosition,
  isDirty,
  languageForPath,
  validateCustomization,
} from "./editorModel";
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
  const draftKey = useMemo(() => ({ environmentId, path }), [environmentId, path]);
  const known = findKnownCustomization(path);

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [saved, setSaved] = useState("");
  const [contents, setContents] = useState("");
  const [lockChoice, setLockChoice] = useState<boolean | undefined>(undefined);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readFile({ environmentId, input: { cwd, path } }).then((result) => {
      if (cancelled || isAtomCommandInterrupted(result)) return;
      if (result._tag === "Success") {
        const onDisk = result.value.contents;
        const draft = readUnsavedDraft(draftKey);
        const restore = draft !== null && draft.saved === onDisk;
        if (!restore) clearUnsavedDraft(draftKey);
        setSaved(onDisk);
        setContents(restore ? draft.contents : onDisk);
        // Restoring an edit means the person had unlocked the file.
        if (restore) setLockChoice(false);
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
  const hints = useMemo(
    () => (load.status === "ready" ? validateCustomization({ path, contents }) : []),
    [contents, load.status, path],
  );
  const isMarkdown = languageForPath(path) === "markdown";
  const display = displayCustomizationPath(path, cwd);

  const onChange = useCallback(
    (next: string) => {
      setContents(next);
      rememberUnsavedDraft(draftKey, { saved, contents: next });
    },
    [draftKey, saved],
  );

  const save = useCallback(async () => {
    if (!canSave({ dirty, locked, saving, creating: false, hasPlan: true })) return;
    setSaving(true);
    setError(null);
    const toWrite = contents;
    try {
      const result = await writeFile({
        environmentId,
        input: { cwd, path, contents: toWrite },
      });
      if (result._tag === "Success") {
        setSaved(toWrite);
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
        return;
      }
      if (isAtomCommandInterrupted(result)) return;
      const message = describeCustomizationsError(squashAtomCommandFailure(result));
      setError(message);
      toastManager.add(
        stackedThreadToast({ type: "error", title: "Couldn't save", description: message }),
      );
    } finally {
      setSaving(false);
    }
  }, [contents, cwd, dirty, display, draftKey, environmentId, locked, path, saving, writeFile]);

  const position = cursorPosition(contents, caret);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="customization-file-panel"
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
          />
        </div>
      ) : (
        <textarea
          value={contents}
          readOnly={locked}
          spellCheck={false}
          aria-label={`Contents of ${display}`}
          onChange={(event) => onChange(event.target.value)}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
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
          Ln {position.line}, Col {position.column}
        </span>
      </div>
    </div>
  );
}
