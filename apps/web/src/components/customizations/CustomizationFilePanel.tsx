import type { EnvironmentId, ScopedThreadRef } from "@t3tools/contracts";
import { Editor } from "@pierre/diffs/editor";
import { EditProvider, File, Virtualizer } from "@pierre/diffs/react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import * as Schema from "effect/Schema";
import { Code2, Eye, LockIcon, LockOpenIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DiffWorkerPoolProvider } from "~/components/DiffWorkerPoolProvider";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Spinner } from "~/components/ui/spinner";
import { Toggle } from "~/components/ui/toggle";
import { useClientSettings } from "~/hooks/useSettings";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useTheme } from "~/hooks/useTheme";
import { resolveDiffThemeName } from "~/lib/diffRendering";
import { PREFERRED_HIGHLIGHTER } from "~/lib/syntaxHighlighting";
import { customizationsEnvironment } from "~/state/customizations";
import { useAtomCommand } from "~/state/use-atom-command";

import { FileMarkdownPreview } from "../files/FileMarkdownPreview";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { projectFileEditorCacheKey } from "../files/fileContentRevision";
import { FileSaveCoordinator } from "../files/fileSaveCoordinator";
import {
  FILE_LINK_REVEAL_UNSAFE_CSS,
  FILE_SURFACE_SUBHEADER_CLASS,
  FileSurfaceAction,
} from "../files/fileSurfaceChrome";
import { isMarkdownPreviewFile } from "../files/filePreviewMode";
import SourceFilePreview from "../files/ReadOnlySourcePreview";
import {
  canUnlock,
  customizationScopeForPath,
  describeCustomizationsError,
  displayCustomizationPath,
  findKnownCustomization,
  resolveLocked,
} from "./customizationsModel";

const SAVE_DEBOUNCE_MS = 500;
// Same key as the workspace file panel: reading markdown rendered is one preference.
const RENDER_MARKDOWN_STORAGE_KEY = "t3code.renderMarkdown";

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly contents: string; readonly readOnly: boolean };

type SaveState = "idle" | "saving" | "saved" | { readonly error: string };

/**
 * Side-panel editor for one Claude customization file. Reads and writes go
 * through the customizations RPCs, and contents live only in this component's
 * state: nothing is cached, logged or kept after the tab closes.
 */
export default function CustomizationFilePanel(props: {
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
  readonly path: string;
  readonly threadRef: ScopedThreadRef;
}) {
  const { environmentId, cwd, path, threadRef } = props;
  const readFile = useAtomCommand(customizationsEnvironment.readFile, { reportFailure: false });
  const writeFile = useAtomCommand(customizationsEnvironment.writeFile, { reportFailure: false });
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [contents, setContents] = useState("");
  const [lockChoice, setLockChoice] = useState<boolean | undefined>(undefined);
  const [save, setSave] = useState<SaveState>("idle");
  const [renderMarkdownPreferred, setRenderMarkdownPreferred] = useLocalStorage(
    RENDER_MARKDOWN_STORAGE_KEY,
    false,
    Schema.Boolean,
  );

  useEffect(() => {
    // The router keys this panel by path, so a new file always starts from "loading".
    let cancelled = false;
    void readFile({ environmentId, input: { cwd, path } }).then((result) => {
      if (cancelled || isAtomCommandInterrupted(result)) return;
      if (result._tag === "Success") {
        setContents(result.value.contents);
        setLoad({
          status: "ready",
          contents: result.value.contents,
          readOnly: result.value.readOnly,
        });
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
  }, [cwd, environmentId, path, readFile]);

  const known = findKnownCustomization(path);
  const scope = known?.scope ?? customizationScopeForPath(path, cwd);
  const readOnly = load.status === "ready" ? load.readOnly : (known?.readOnly ?? false);
  const locked = resolveLocked({ scope, readOnly, choice: lockChoice });
  const isMarkdown = isMarkdownPreviewFile(path);
  const renderMarkdown = isMarkdown && renderMarkdownPreferred;
  const displayPath = displayCustomizationPath(path, cwd);

  const coordinatorRef = useRef<FileSaveCoordinator | null>(null);
  useEffect(() => {
    const coordinator = new FileSaveCoordinator({
      debounceMs: SAVE_DEBOUNCE_MS,
      onPendingChange: (pending) => {
        if (pending) setSave("saving");
      },
      persist: async (nextContents) => {
        const result = await writeFile({
          environmentId,
          input: { cwd, path, contents: nextContents },
        });
        if (result._tag !== "Success" && !isAtomCommandInterrupted(result)) {
          setSave({ error: describeCustomizationsError(squashAtomCommandFailure(result)) });
        }
        return result;
      },
      onConfirmed: () => {
        setSave("saved");
        appAtomRegistry.refresh(customizationsEnvironment.list({ environmentId, input: { cwd } }));
      },
    });
    coordinatorRef.current = coordinator;
    return () => {
      coordinatorRef.current = null;
      coordinator.dispose();
    };
  }, [cwd, environmentId, path, writeFile]);

  const handleChange = useCallback((nextContents: string) => {
    setContents(nextContents);
    coordinatorRef.current?.change(nextContents);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className={FILE_SURFACE_SUBHEADER_CLASS} data-surface-subheader>
        <ScrollArea radius="none" hideScrollbars scrollFade className="min-w-0 flex-1">
          <div className="flex h-full w-max min-w-full items-center gap-2 text-xs">
            <span className="font-mono text-foreground">{displayPath}</span>
            <span className="text-muted-foreground">{scope}</span>
          </div>
        </ScrollArea>
        <SaveStatus state={save} />
        {isMarkdown ? (
          <FileSurfaceAction
            label={renderMarkdown ? "Show markdown source" : "Show rendered markdown"}
            pressed={renderMarkdown}
            onPress={() => setRenderMarkdownPreferred(!renderMarkdown)}
          >
            {renderMarkdown ? <Code2 className="size-3.5" /> : <Eye className="size-3.5" />}
          </FileSurfaceAction>
        ) : null}
        <Toggle
          variant="outline"
          size="sm"
          className="shrink-0"
          pressed={locked}
          disabled={!canUnlock({ readOnly })}
          onPressedChange={(pressed) => setLockChoice(pressed)}
          aria-label={locked ? "Locked: unlock to edit" : "Editing: lock the file"}
        >
          {locked ? <LockIcon className="size-3.5" /> : <LockOpenIcon className="size-3.5" />}
          {locked ? "Locked" : "Editing"}
        </Toggle>
      </div>
      {readOnly ? (
        <div className="shrink-0 border-b border-warning/20 bg-warning-surface px-3 py-1.5 text-2xs text-warning-foreground">
          This file holds secrets such as API keys and tokens. It is read-only here and is never
          cached.
        </div>
      ) : null}
      {typeof save === "object" ? (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/8 px-3 py-1.5 text-2xs text-destructive-foreground">
          Not saved. {save.error}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {load.status === "loading" ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-muted-foreground">
            <Spinner size="lg" />
          </div>
        ) : load.status === "error" ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-xs leading-relaxed text-destructive">
            {load.message}
          </div>
        ) : renderMarkdown ? (
          <ScrollArea className="min-h-0 flex-1">
            <FileMarkdownPreview
              text={contents}
              cwd={cwd}
              relativePath={path}
              threadRef={threadRef}
            />
          </ScrollArea>
        ) : locked ? (
          // No cacheKey: ~/.claude.json holds secrets and must not sit in the highlighter cache.
          <SourceFilePreview name={path} text={contents} />
        ) : (
          <EditableSurface
            environmentId={environmentId}
            cwd={cwd}
            path={path}
            contents={contents}
            onChange={handleChange}
          />
        )}
      </div>
    </div>
  );
}

function SaveStatus({ state }: { readonly state: SaveState }) {
  const label = state === "saving" ? "Saving…" : state === "saved" ? "Saved" : null;
  return label ? <span className="shrink-0 text-2xs text-muted-foreground">{label}</span> : null;
}

/** The workspace file editor's pierre editor without line comments, which have no home here. */
function EditableSurface(props: {
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
  readonly path: string;
  readonly contents: string;
  readonly onChange: (contents: string) => void;
}) {
  const { environmentId, cwd, path, contents, onChange } = props;
  const { resolvedTheme } = useTheme();
  const wordWrap = useClientSettings((settings) => settings.wordWrap);
  const editor = useMemo(
    () =>
      new Editor({
        persistState: true,
        persistStateStorage: "inMemory",
        onChange: (file) => onChange(file.contents),
      }),
    [onChange],
  );
  useEffect(
    () => () => {
      editor.cleanUp();
    },
    [editor],
  );

  return (
    <DiffWorkerPoolProvider>
      <EditProvider editor={editor}>
        <div className="flex min-h-0 flex-1">
          <Virtualizer
            key={`${path}:${resolvedTheme}`}
            className="file-preview-virtualizer min-h-0 flex-1 overflow-auto"
            config={{ overscrollSize: 600, intersectionObserverMargin: 1200 }}
          >
            <File
              file={{
                name: path,
                contents,
                cacheKey: projectFileEditorCacheKey(
                  environmentId,
                  cwd,
                  path,
                  contents,
                  editor.getFile(),
                ),
              }}
              options={{
                disableFileHeader: true,
                overflow: wordWrap ? "wrap" : "scroll",
                theme: resolveDiffThemeName(resolvedTheme),
                preferredHighlighter: PREFERRED_HIGHLIGHTER,
                themeType: resolvedTheme,
                unsafeCSS: FILE_LINK_REVEAL_UNSAFE_CSS,
              }}
              className="min-h-full"
              contentEditable
            />
          </Virtualizer>
        </div>
      </EditProvider>
    </DiffWorkerPoolProvider>
  );
}
