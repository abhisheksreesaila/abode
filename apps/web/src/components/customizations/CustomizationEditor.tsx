import type {
  CustomizationHarness,
  CustomizationKind,
  CustomizationScope,
} from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  AlertTriangleIcon,
  ChevronRightIcon,
  LockIcon,
  LockOpenIcon,
  Maximize2Icon,
  Minimize2Icon,
  XIcon,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ChatMarkdown from "~/components/ChatMarkdown";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Dialog, DialogDescription, DialogPopup, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Spinner } from "~/components/ui/spinner";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { Toggle, ToggleGroup } from "~/components/ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useClientSettings } from "~/hooks/useSettings";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { customizationsEnvironment } from "~/state/customizations";
import { useAtomCommand } from "~/state/use-atom-command";
import { cn } from "~/lib/utils";
import { resolvePathLinkTarget } from "~/terminal-links";

import SourceFilePreview from "../files/ReadOnlySourcePreview";
import type { CustomizationsScope } from "./CustomizationsSection";
import { CustomizationEditorSurface, type EditorCursor } from "./CustomizationEditorSurface";
import {
  type EditorMode,
  LANGUAGE_LABEL,
  canSave,
  decideClose,
  isDirty,
  languageForPath,
  modeAfterCreate,
  validateCustomization,
} from "./customizationEditorModel";
import {
  canUnlock,
  customizationScopeForPath,
  describeCustomizationsError,
  displayCustomizationPath,
  findKnownCustomization,
  resolveLocked,
} from "./customizationsModel";
import { availableScopes, coerceScope, needsName, planNewCustomization } from "./newCustomization";

export type CustomizationEditorTarget =
  | { readonly type: "edit"; readonly path: string }
  | {
      readonly type: "create";
      readonly kind: CustomizationKind;
      readonly defaultHarness: CustomizationHarness;
    };

const KIND_NOUN: Record<CustomizationKind, string> = {
  skill: "skill",
  agent: "agent",
  instructions: "instructions file",
  mcp: "MCP file",
};

const SCOPE_LABEL: Record<CustomizationScope, string> = {
  workspace: "This workspace",
  user: "All workspaces",
};

function fixedFileNote(kind: CustomizationKind, harness: CustomizationHarness): string | null {
  if (kind === "agent" && harness === "codex") {
    return "Codex has no agents; this creates a custom prompt in ~/.codex/prompts.";
  }
  if (kind === "instructions") {
    const file = harness === "codex" ? "AGENTS.md" : "CLAUDE.md";
    return `Creates ${file} if it is missing; an existing file just opens.`;
  }
  if (kind === "mcp") {
    return harness === "codex"
      ? "Codex declares MCP servers in ~/.codex/config.toml. It opens read-only: edit it outside abode."
      : "Opens .mcp.json in the workspace root, creating it if it is missing.";
  }
  return null;
}

function harnessForPath(path: string): CustomizationHarness {
  return /\/\.codex\//.test(path.replaceAll("\\", "/")) ? "codex" : "claude";
}

/** Whether keyboard focus sits in a text field inside a shadow root: the editor's find widget. */
function isFocusInShadowInput(): boolean {
  let active: Element | null = document.activeElement;
  let crossedShadow = false;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
    crossedShadow = true;
  }
  return crossedShadow && (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA");
}

function notify(type: "success" | "error", title: string, description?: string) {
  toastManager.add(
    stackedThreadToast({ type, title, ...(description ? { description } : {}), timeout: 3500 }),
  );
}

interface Chrome {
  readonly maximized: boolean;
  readonly onToggleMaximize: () => void;
  readonly onRequestClose: () => void;
  /** Reports whether closing now would lose work. */
  readonly onDirtyChange: (dirty: boolean) => void;
  readonly onChanged: () => void;
}

/**
 * The big customization editor (abode F-045): one surface for opening a file and for creating one.
 * Create mode adds a compact form row above the editor and, once saved, turns into edit mode for
 * the new file in place. About 80vw by 80vh, full screen on request and on phones.
 */
export function CustomizationEditorDialog({
  scope,
  target,
  onClose,
  onChanged,
}: {
  readonly scope: CustomizationsScope;
  readonly target: CustomizationEditorTarget;
  readonly onClose: () => void;
  /** The file list should refresh: a file was created or saved. */
  readonly onChanged: () => void;
}) {
  const [mode, setMode] = useState<EditorMode>(
    target.type === "edit" ? target : { type: "create", kind: target.kind },
  );
  // Contents we just wrote on create: the edit session starts from them instead of re-reading.
  const [seed, setSeed] = useState<string | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Esc inside the editor's find widget closes the widget only. The widget lives in a shadow root,
  // and it may close itself before the dialog's own key handler runs, so look at Esc on capture.
  const escapeInFind = useRef(false);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") escapeInFind.current = isFocusInShadowInput();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  const requestClose = useCallback(
    (viaEscape: boolean) => {
      const decision = decideClose({ dirty, maximized, viaEscape });
      if (decision === "exit-fullscreen") setMaximized(false);
      else if (decision === "confirm-discard") setConfirming(true);
      else onClose();
    },
    [dirty, maximized, onClose],
  );

  const chrome: Chrome = {
    maximized,
    onToggleMaximize: () => setMaximized((current) => !current),
    onRequestClose: () => requestClose(false),
    onDirtyChange: setDirty,
    onChanged,
  };

  return (
    <>
      <Dialog
        open
        onOpenChange={(next, details) => {
          if (next) return;
          const viaEscape = details.reason === "escape-key";
          if (viaEscape && escapeInFind.current) return;
          requestClose(viaEscape);
        }}
      >
        <DialogPopup
          variant={maximized ? "editor-full" : "editor"}
          showCloseButton={false}
          bottomStickOnMobile={false}
        >
          <DialogTitle className="sr-only">
            {mode.type === "create"
              ? `New ${KIND_NOUN[mode.kind]}`
              : (displayCustomizationPath(mode.path, scope.cwd).split("/").pop() ?? mode.path)}
          </DialogTitle>
          <DialogDescription className="sr-only">{scope.projectName}</DialogDescription>
          {mode.type === "create" ? (
            <CreateSession
              scope={scope}
              kind={mode.kind}
              defaultHarness={target.type === "create" ? target.defaultHarness : "claude"}
              chrome={chrome}
              onCreated={(path, contents) => {
                setSeed(contents);
                setMode(modeAfterCreate({ path }));
                setDirty(false);
              }}
              onOpenExisting={(path) => {
                setSeed(null);
                setMode({ type: "edit", path });
                setDirty(false);
              }}
            />
          ) : (
            <EditSession
              key={mode.path}
              scope={scope}
              path={mode.path}
              seed={seed}
              chrome={chrome}
            />
          )}
        </DialogPopup>
      </Dialog>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits to this file have not been saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Keep editing</AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                onClose();
              }}
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Shell: flat header, body and status line shared by both sessions.
// ---------------------------------------------------------------------------------------------

function Breadcrumb({ segments }: { readonly segments: ReadonlyArray<string> }) {
  return (
    <ScrollArea radius="none" hideScrollbars scrollFade className="min-w-0 flex-1">
      <ol className="flex h-full w-max min-w-full items-center gap-0.5 font-mono text-xs text-muted-foreground">
        {segments.map((segment, index) => {
          const last = index === segments.length - 1;
          return (
            <li key={segments.slice(0, index + 1).join("/")} className="flex items-center gap-0.5">
              {index > 0 ? <ChevronRightIcon aria-hidden className="size-3 opacity-60" /> : null}
              <span className={cn(last && "font-medium text-foreground")}>{segment}</span>
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}

function HeaderButton(props: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
  readonly disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="toolbar"
            size="icon-toolbar"
            aria-label={props.label}
            disabled={props.disabled ?? false}
            onClick={props.onClick}
          />
        }
      >
        {props.children}
      </TooltipTrigger>
      <TooltipPopup side="bottom">{props.label}</TooltipPopup>
    </Tooltip>
  );
}

function EditorShell(props: {
  readonly chrome: Chrome;
  readonly breadcrumb: ReadonlyArray<string>;
  readonly badges: ReactNode;
  readonly dirty: boolean;
  readonly actions: ReactNode;
  readonly form?: ReactNode;
  readonly banners?: ReactNode;
  readonly children: ReactNode;
  readonly status: ReactNode;
  readonly hints: ReadonlyArray<string>;
}) {
  const { chrome } = props;
  // Phones have no room for the one-line hint, so it collapses to a count that opens the list.
  const [hintsOpen, setHintsOpen] = useState(false);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <Breadcrumb segments={props.breadcrumb} />
        <div className="flex shrink-0 items-center gap-1.5 max-sm:hidden">{props.badges}</div>
        {props.dirty ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  role="img"
                  aria-label="Unsaved changes"
                  className="size-2 shrink-0 rounded-full bg-warning"
                />
              }
            />
            <TooltipPopup side="bottom">Unsaved changes</TooltipPopup>
          </Tooltip>
        ) : null}
        <div className="flex shrink-0 items-center gap-1">
          {props.actions}
          <HeaderButton
            label={chrome.maximized ? "Exit full screen" : "Full screen"}
            onClick={chrome.onToggleMaximize}
          >
            {chrome.maximized ? <Minimize2Icon /> : <Maximize2Icon />}
          </HeaderButton>
          <HeaderButton label="Close" onClick={chrome.onRequestClose}>
            <XIcon />
          </HeaderButton>
        </div>
      </header>
      {props.form}
      {props.banners}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{props.children}</div>
      {hintsOpen && props.hints.length > 0 ? (
        <ul className="shrink-0 border-t border-warning/20 bg-warning-surface px-3 py-1.5 text-2xs text-warning-foreground sm:hidden">
          {props.hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : null}
      <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border/60 bg-card/40 px-3 text-2xs text-muted-foreground">
        {props.hints.length > 0 ? (
          <button
            type="button"
            aria-expanded={hintsOpen}
            aria-label={`${props.hints.length} validation warning${props.hints.length === 1 ? "" : "s"}`}
            onClick={() => setHintsOpen((current) => !current)}
            className="flex shrink-0 cursor-pointer items-center gap-1 text-warning-foreground sm:hidden"
          >
            <AlertTriangleIcon aria-hidden className="size-3" />
            <span className="tabular-nums">{props.hints.length}</span>
          </button>
        ) : null}
        {props.hints.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="flex min-w-0 items-center gap-1 text-warning-foreground max-sm:hidden" />
              }
            >
              <AlertTriangleIcon aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{props.hints[0]}</span>
              {props.hints.length > 1 ? (
                <span className="shrink-0 tabular-nums">+{props.hints.length - 1}</span>
              ) : null}
            </TooltipTrigger>
            <TooltipPopup side="top">
              <ul className="grid max-w-sm gap-1">
                {props.hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            </TooltipPopup>
          </Tooltip>
        ) : null}
        <div className="ms-auto flex shrink-0 items-center gap-3">{props.status}</div>
      </footer>
    </div>
  );
}

function StatusItems(props: {
  readonly path: string;
  readonly cursor: EditorCursor;
  readonly showCursor: boolean;
}) {
  return (
    <>
      {props.showCursor ? (
        <span className="tabular-nums">
          Ln {props.cursor.line}, Col {props.cursor.column}
        </span>
      ) : null}
      <span>{LANGUAGE_LABEL[languageForPath(props.path)]}</span>
      <span>UTF-8</span>
    </>
  );
}

const SAVE_SHORTCUT =
  typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘S" : "Ctrl+S";

function SaveButton(props: {
  readonly label: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  return (
    <Button
      size="compact"
      title={`${props.label} (${SAVE_SHORTCUT})`}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.label}
    </Button>
  );
}

/** Ctrl/Cmd+S saves from anywhere in the dialog, including inside the editor. */
function useSaveShortcut(onSave: () => void) {
  const latest = useRef(onSave);
  useEffect(() => {
    latest.current = onSave;
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        latest.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

type ViewMode = "edit" | "split" | "preview";

function ViewToggle(props: { readonly value: ViewMode; readonly onChange: (v: ViewMode) => void }) {
  return (
    <ToggleGroup
      aria-label="Markdown view"
      value={[props.value]}
      onValueChange={(next) => {
        const value = next[0];
        if (value === "edit" || value === "split" || value === "preview") props.onChange(value);
      }}
    >
      <Toggle value="edit">Edit</Toggle>
      <Toggle value="split" className="max-sm:hidden">
        Split
      </Toggle>
      <Toggle value="preview">Preview</Toggle>
    </ToggleGroup>
  );
}

function MarkdownPane(props: {
  readonly scope: CustomizationsScope;
  readonly path: string;
  readonly text: string;
}) {
  const text = useDeferredValue(props.text);
  const lastSeparator = Math.max(props.path.lastIndexOf("/"), props.path.lastIndexOf("\\"));
  const imageBaseDir =
    lastSeparator >= 0
      ? resolvePathLinkTarget(props.path.slice(0, lastSeparator), props.scope.cwd)
      : props.scope.cwd;
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ChatMarkdown
        text={text}
        cwd={props.scope.cwd}
        imageBaseDir={imageBaseDir}
        threadRef={props.scope.threadRef ?? undefined}
        className="mx-auto max-w-3xl px-6 py-5"
      />
    </ScrollArea>
  );
}

/** Editor, preview or both side by side, depending on the view. */
function Body(props: {
  readonly scope: CustomizationsScope;
  readonly path: string;
  readonly contents: string;
  readonly view: ViewMode;
  readonly locked: boolean;
  readonly autoFocus: boolean;
  readonly onChange: (contents: string) => void;
  readonly onCursorChange: (cursor: EditorCursor) => void;
}) {
  const { scope, path, contents, view, locked, autoFocus } = props;
  const wordWrap = useClientSettings((settings) => settings.wordWrap);
  const isMarkdown = languageForPath(path) === "markdown";
  const showPreview = isMarkdown && view !== "edit";
  const showCode = !isMarkdown || view !== "preview";
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {showCode ? (
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            view === "split" && "border-e border-border/60",
          )}
        >
          {locked ? (
            // No cacheKey: ~/.claude.json holds secrets and must not sit in the highlighter cache.
            <SourceFilePreview name={path} text={contents} />
          ) : (
            <CustomizationEditorSurface
              environmentId={scope.environmentId}
              cwd={scope.cwd}
              path={path}
              contents={contents}
              wrap={isMarkdown || wordWrap}
              autoFocus={autoFocus}
              onChange={props.onChange}
              onCursorChange={props.onCursorChange}
            />
          )}
        </div>
      ) : null}
      {showPreview ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MarkdownPane scope={scope} path={path} text={contents} />
        </div>
      ) : null}
    </div>
  );
}

function ErrorBanner({ message }: { readonly message: string }) {
  return (
    <div
      role="alert"
      className="shrink-0 border-b border-destructive/20 bg-destructive/8 px-3 py-1.5 text-xs text-destructive-foreground"
    >
      {message}
    </div>
  );
}

function ScopeBadges(props: {
  readonly harness: CustomizationHarness;
  readonly scope: CustomizationScope;
  readonly readOnly?: boolean;
}) {
  return (
    <>
      <Badge size="sm" variant="outline">
        {props.harness === "codex" ? "Codex" : "Claude"}
      </Badge>
      <Badge size="sm" variant={props.scope === "user" ? "info" : "secondary"}>
        {props.scope}
      </Badge>
      {props.readOnly ? (
        <Badge size="sm" variant="warning">
          read-only
        </Badge>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Edit session
// ---------------------------------------------------------------------------------------------

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly readOnly: boolean };

function EditSession(props: {
  readonly scope: CustomizationsScope;
  readonly path: string;
  readonly seed: string | null;
  readonly chrome: Chrome;
}) {
  const { scope, path, seed, chrome } = props;
  const { onDirtyChange, onChanged } = chrome;
  const readFile = useAtomCommand(customizationsEnvironment.readFile, { reportFailure: false });
  const writeFile = useAtomCommand(customizationsEnvironment.writeFile, { reportFailure: false });
  const known = findKnownCustomization(path);
  const [load, setLoad] = useState<LoadState>(
    seed === null ? { status: "loading" } : { status: "ready", readOnly: false },
  );
  const [saved, setSaved] = useState(seed ?? "");
  const [contents, setContents] = useState(seed ?? "");
  const [lockChoice, setLockChoice] = useState<boolean | undefined>(
    seed === null ? undefined : false,
  );
  const [view, setView] = useState<ViewMode>("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<EditorCursor>({ line: 1, column: 1 });

  useEffect(() => {
    if (seed !== null) return;
    let cancelled = false;
    void readFile({
      environmentId: scope.environmentId,
      input: { cwd: scope.cwd, path },
    }).then((result) => {
      if (cancelled || isAtomCommandInterrupted(result)) return;
      if (result._tag === "Success") {
        setSaved(result.value.contents);
        setContents(result.value.contents);
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
  }, [path, readFile, scope.cwd, scope.environmentId, seed]);

  const itemScope = known?.scope ?? customizationScopeForPath(path, scope.cwd);
  const readOnly = load.status === "ready" ? load.readOnly : (known?.readOnly ?? false);
  const locked = resolveLocked({ scope: itemScope, readOnly, choice: lockChoice });
  const dirty = load.status === "ready" && isDirty(saved, contents);
  const isMarkdown = languageForPath(path) === "markdown";
  const hints = useMemo(
    () => (load.status === "ready" ? validateCustomization({ path, contents }) : []),
    [contents, load.status, path],
  );

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const save = useCallback(async () => {
    if (!canSave({ dirty, locked, saving, creating: false, hasPlan: true })) return;
    setSaving(true);
    setError(null);
    const toWrite = contents;
    try {
      const result = await writeFile({
        environmentId: scope.environmentId,
        input: { cwd: scope.cwd, path, contents: toWrite },
      });
      if (result._tag === "Success") {
        setSaved(toWrite);
        notify("success", "Saved", displayCustomizationPath(path, scope.cwd));
        appAtomRegistry.refresh(
          customizationsEnvironment.list({
            environmentId: scope.environmentId,
            input: { cwd: scope.cwd },
          }),
        );
        onChanged();
        return;
      }
      if (isAtomCommandInterrupted(result)) return;
      const message = describeCustomizationsError(squashAtomCommandFailure(result));
      setError(message);
      notify("error", "Couldn't save", message);
    } finally {
      setSaving(false);
    }
  }, [contents, dirty, locked, onChanged, path, saving, scope.cwd, scope.environmentId, writeFile]);
  useSaveShortcut(() => void save());

  const display = displayCustomizationPath(path, scope.cwd);
  const breadcrumb = [
    ...(itemScope === "workspace" ? [scope.projectName] : []),
    ...display.split("/").filter((segment) => segment.length > 0),
  ];

  return (
    <EditorShell
      chrome={chrome}
      breadcrumb={breadcrumb}
      badges={<ScopeBadges harness={harnessForPath(path)} scope={itemScope} readOnly={readOnly} />}
      dirty={dirty}
      hints={hints.map((hint) => hint.message)}
      actions={
        load.status === "ready" ? (
          <>
            {isMarkdown ? <ViewToggle value={view} onChange={setView} /> : null}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="toolbar"
                    size="compact"
                    disabled={!canUnlock({ readOnly })}
                    aria-pressed={locked}
                    aria-label="Lock file"
                    onClick={() => setLockChoice(!locked)}
                  />
                }
              >
                {locked ? <LockIcon /> : <LockOpenIcon />}
                <span className="max-sm:hidden">{locked ? "Locked" : "Editing"}</span>
              </TooltipTrigger>
              <TooltipPopup side="bottom">
                {readOnly
                  ? "Read-only: this file can't be edited here"
                  : itemScope === "user"
                    ? "Shared by every workspace, so it opens locked"
                    : locked
                      ? "Unlock to edit"
                      : "Lock to prevent edits"}
              </TooltipPopup>
            </Tooltip>
            <SaveButton
              label="Save"
              disabled={!canSave({ dirty, locked, saving, creating: false, hasPlan: true })}
              onClick={() => void save()}
            />
          </>
        ) : null
      }
      banners={
        <>
          {readOnly ? (
            <div className="shrink-0 border-b border-warning/20 bg-warning-surface px-3 py-1.5 text-xs text-warning-foreground">
              This file holds secrets such as API keys and tokens. It is read-only here and is never
              cached.
            </div>
          ) : null}
          {error ? <ErrorBanner message={`Not saved. ${error}`} /> : null}
        </>
      }
      status={
        <>
          {saving ? <span>Saving…</span> : dirty ? <span>Unsaved changes</span> : null}
          <StatusItems
            path={path}
            cursor={cursor}
            showCursor={!locked && load.status === "ready"}
          />
        </>
      }
    >
      {load.status === "loading" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-muted-foreground">
          <Spinner size="lg" />
        </div>
      ) : load.status === "error" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm leading-relaxed text-destructive">
          {load.message}
        </div>
      ) : (
        <Body
          scope={scope}
          path={path}
          contents={contents}
          view={view}
          locked={locked}
          autoFocus
          onChange={setContents}
          onCursorChange={setCursor}
        />
      )}
    </EditorShell>
  );
}

// ---------------------------------------------------------------------------------------------
// Create session
// ---------------------------------------------------------------------------------------------

function CreateSession(props: {
  readonly scope: CustomizationsScope;
  readonly kind: CustomizationKind;
  readonly defaultHarness: CustomizationHarness;
  readonly chrome: Chrome;
  readonly onCreated: (path: string, contents: string) => void;
  readonly onOpenExisting: (path: string) => void;
}) {
  const { scope, kind, chrome, onCreated, onOpenExisting } = props;
  const { onDirtyChange, onChanged } = chrome;
  const readFile = useAtomCommand(customizationsEnvironment.readFile, { reportFailure: false });
  const writeFile = useAtomCommand(customizationsEnvironment.writeFile, { reportFailure: false });
  const [name, setName] = useState("");
  const [harness, setHarness] = useState<CustomizationHarness>(props.defaultHarness);
  const [scopeChoice, setScopeChoice] = useState<CustomizationScope>("workspace");
  const [edited, setEdited] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<ViewMode>("edit");
  const [cursor, setCursor] = useState<EditorCursor>({ line: 1, column: 1 });

  const effectiveScope = coerceScope(kind, harness, scopeChoice);
  const scopes = availableScopes(kind, harness);
  const plan = useMemo(
    () => planNewCustomization({ kind, harness, scope: effectiveScope, name, cwd: scope.cwd }),
    [effectiveScope, harness, kind, name, scope.cwd],
  );
  const contents = edited ?? plan?.contents ?? "";
  const note = fixedFileNote(kind, harness);
  const dirty = name.trim() !== "" || edited !== null;
  const hints = useMemo(
    () => (plan && !plan.readOnly ? validateCustomization({ path: plan.path, contents }) : []),
    [contents, plan],
  );

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // Instructions and MCP files are open-or-create: when the target already exists, go straight to
  // editing it. If the user already typed into the template, ask first instead of discarding it.
  const editedRef = useRef(edited);
  useEffect(() => {
    editedRef.current = edited;
  }, [edited]);
  const [existingPath, setExistingPath] = useState<string | null>(null);
  const checkPath = plan?.openIfExists ? plan.path : null;
  useEffect(() => {
    setExistingPath(null);
    if (checkPath === null) return;
    let cancelled = false;
    void readFile({
      environmentId: scope.environmentId,
      input: { cwd: scope.cwd, path: checkPath },
    }).then((result) => {
      if (cancelled || result._tag !== "Success") return;
      if (editedRef.current === null) onOpenExisting(result.value.path);
      else setExistingPath(result.value.path);
    });
    return () => {
      cancelled = true;
    };
  }, [checkPath, onOpenExisting, readFile, scope.cwd, scope.environmentId]);

  // Name edits keep a hand-edited body; Harness and Scope swap the template, so they confirm first.
  const [pendingChange, setPendingChange] = useState<(() => void) | null>(null);
  const changeTemplateInput = (apply: () => void) => {
    setError(null);
    if (edited === null) {
      apply();
      return;
    }
    setPendingChange(() => apply);
  };

  const create = useCallback(async () => {
    if (!plan || busy) return;
    setBusy(true);
    setError(null);
    try {
      const input = { cwd: scope.cwd, path: plan.path };
      // Instructions and MCP files open when they exist; skills and agents are create-only.
      if (plan.openIfExists) {
        const existing = await readFile({ environmentId: scope.environmentId, input });
        if (existing._tag === "Success") {
          onOpenExisting(existing.value.path);
          return;
        }
        if (isAtomCommandInterrupted(existing)) return;
        if (plan.readOnly) {
          setError(`${plan.path} does not exist yet, and abode can't create it.`);
          return;
        }
      }
      const written = await writeFile({
        environmentId: scope.environmentId,
        input: { ...input, contents, ...(plan.openIfExists ? {} : { createOnly: true }) },
      });
      if (written._tag === "Success") {
        notify(
          "success",
          `Created ${KIND_NOUN[kind]}`,
          displayCustomizationPath(plan.path, scope.cwd),
        );
        onChanged();
        onCreated(written.value.path, contents);
        return;
      }
      if (isAtomCommandInterrupted(written)) return;
      const message = describeCustomizationsError(squashAtomCommandFailure(written));
      setError(message);
      notify("error", "Couldn't create the file", message);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    contents,
    kind,
    onChanged,
    onCreated,
    onOpenExisting,
    plan,
    readFile,
    scope.cwd,
    scope.environmentId,
    writeFile,
  ]);
  useSaveShortcut(() => void create());

  const display = plan ? displayCustomizationPath(plan.path, scope.cwd) : null;
  const breadcrumb = display
    ? [
        ...(effectiveScope === "workspace" ? [scope.projectName] : []),
        ...display.split("/").filter((segment) => segment.length > 0),
      ]
    : [`New ${KIND_NOUN[kind]}`];
  const showEditor = plan !== null && !plan.readOnly;

  return (
    <EditorShell
      chrome={chrome}
      breadcrumb={breadcrumb}
      badges={<ScopeBadges harness={harness} scope={effectiveScope} />}
      dirty={dirty}
      hints={hints.map((hint) => hint.message)}
      actions={
        <>
          {showEditor && languageForPath(plan.path) === "markdown" ? (
            <ViewToggle value={view} onChange={setView} />
          ) : null}
          <SaveButton
            label={plan?.readOnly ? "Open" : "Create"}
            disabled={!plan || busy}
            onClick={() => void create()}
          />
        </>
      }
      form={
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 bg-card/30 px-3 py-2">
          {needsName(kind) ? (
            <label className="flex min-w-48 flex-1 items-center gap-2 text-xs font-medium sm:max-w-80">
              Name
              <Input
                aria-label="Name"
                autoFocus
                size="sm"
                placeholder="deploy-helper"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
              />
            </label>
          ) : null}
          <div className="flex items-center gap-2 text-xs font-medium">
            Harness
            <ToggleGroup
              aria-label="Harness"
              value={[harness]}
              onValueChange={(next) => {
                const value = next[0];
                if (value === "claude" || value === "codex") {
                  changeTemplateInput(() => setHarness(value));
                }
              }}
            >
              <Toggle value="claude">Claude</Toggle>
              <Toggle value="codex">Codex</Toggle>
            </ToggleGroup>
          </div>
          {scopes.length > 1 ? (
            <div className="flex items-center gap-2 text-xs font-medium">
              Scope
              <ToggleGroup
                aria-label="Scope"
                value={[effectiveScope]}
                onValueChange={(next) => {
                  const value = next[0];
                  if (value === "workspace" || value === "user") {
                    changeTemplateInput(() => setScopeChoice(value));
                  }
                }}
              >
                {scopes.map((option) => (
                  <Toggle key={option} value={option}>
                    {SCOPE_LABEL[option]}
                  </Toggle>
                ))}
              </ToggleGroup>
            </div>
          ) : null}
          {note ? <p className="w-full text-xs text-muted-foreground">{note}</p> : null}
        </div>
      }
      banners={
        <>
          {existingPath ? (
            <div className="flex shrink-0 items-center gap-3 border-b border-warning/20 bg-warning-surface px-3 py-1.5 text-xs text-warning-foreground">
              <span className="min-w-0 flex-1">
                This file already exists. Opening it discards what you typed here.
              </span>
              <Button size="compact" variant="outline" onClick={() => onOpenExisting(existingPath)}>
                Open existing
              </Button>
            </div>
          ) : null}
          {error ? <ErrorBanner message={error} /> : null}
          <AlertDialog
            open={pendingChange !== null}
            onOpenChange={(next) => {
              if (!next) setPendingChange(null);
            }}
          >
            <AlertDialogPopup>
              <AlertDialogHeader>
                <AlertDialogTitle>Replace your edits with a new template?</AlertDialogTitle>
                <AlertDialogDescription>
                  Changing the harness or scope starts from that template again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogClose render={<Button variant="outline" />}>
                  Keep my edits
                </AlertDialogClose>
                <Button
                  variant="destructive"
                  onClick={() => {
                    pendingChange?.();
                    setEdited(null);
                    setPendingChange(null);
                  }}
                >
                  Replace
                </Button>
              </AlertDialogFooter>
            </AlertDialogPopup>
          </AlertDialog>
        </>
      }
      status={
        <>
          {busy ? <span>Creating…</span> : null}
          <StatusItems path={plan?.path ?? ""} cursor={cursor} showCursor={showEditor} />
        </>
      }
    >
      {showEditor ? (
        <Body
          scope={scope}
          path={plan.path}
          contents={contents}
          view={view}
          locked={false}
          autoFocus={!needsName(kind)}
          onChange={setEdited}
          onCursorChange={setCursor}
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {plan?.readOnly
            ? "This file opens read-only."
            : `Name your ${KIND_NOUN[kind]} to start from a template.`}
        </div>
      )}
    </EditorShell>
  );
}
