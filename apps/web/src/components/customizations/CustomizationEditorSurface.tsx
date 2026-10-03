import type { EnvironmentId } from "@t3tools/contracts";
import { Editor } from "@pierre/diffs/editor";
import { EditProvider, File, Virtualizer } from "@pierre/diffs/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { DiffWorkerPoolProvider } from "~/components/DiffWorkerPoolProvider";
import { useTheme } from "~/hooks/useTheme";
import { resolveDiffThemeName } from "~/lib/diffRendering";
import { PREFERRED_HIGHLIGHTER } from "~/lib/syntaxHighlighting";

import { projectFileEditorCacheKey } from "../files/fileContentRevision";
import { FILE_LINK_REVEAL_UNSAFE_CSS } from "../files/fileSurfaceChrome";

/** 13px code on a 20px line: comfortable without feeling loose. Uses the theme's mono stack. */
const EDITOR_UNSAFE_CSS = `
  ${FILE_LINK_REVEAL_UNSAFE_CSS}

  diffs-container {
    --diffs-font-size: 13px;
    --diffs-line-height: 20px;
  }
`;

export interface EditorCursor {
  readonly line: number;
  readonly column: number;
}

/**
 * The pierre editor, sized for the customization editor: line numbers, markdown, JSON and TOML
 * highlighting, built-in find (Ctrl/Cmd+F while the editor has focus), 13px code and optional soft
 * wrap. Contents live in the parent; nothing is stored beyond the in-memory editor state.
 */
export function CustomizationEditorSurface(props: {
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
  /** Names the language for highlighting; also part of the editor's cache identity. */
  readonly path: string;
  readonly contents: string;
  readonly wrap: boolean;
  /** Focus lands in the editor when it attaches; off while a name field above still needs typing. */
  readonly autoFocus: boolean;
  readonly onChange: (contents: string) => void;
  readonly onCursorChange: (cursor: EditorCursor) => void;
}) {
  const { environmentId, cwd, path, contents, wrap, autoFocus, onChange, onCursorChange } = props;
  const { resolvedTheme } = useTheme();
  const frame = useRef<number | null>(null);
  const editorRef = useRef<Editor<unknown> | null>(null);

  const reportCursor = useCallback(() => {
    if (frame.current !== null) return;
    // One read per frame no matter how many key or pointer events arrive.
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const end = editorRef.current?.getState().selections?.[0]?.end;
      if (end) onCursorChange({ line: end.line + 1, column: end.character + 1 });
    });
  }, [onCursorChange]);

  const editor = useMemo(
    () =>
      new Editor({
        persistState: true,
        persistStateStorage: "inMemory",
        onAttach: (attached) => {
          if (autoFocus) attached.focus();
        },
        onChange: (file) => {
          onChange(file.contents);
          reportCursor();
        },
      }),
    [autoFocus, onChange, reportCursor],
  );
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);
  useEffect(
    () => () => {
      editor.cleanUp();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    },
    [editor],
  );

  return (
    <DiffWorkerPoolProvider>
      <EditProvider editor={editor}>
        <div
          className="flex min-h-0 flex-1"
          onKeyUp={reportCursor}
          onPointerUp={reportCursor}
          onFocus={reportCursor}
        >
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
                overflow: wrap ? "wrap" : "scroll",
                theme: resolveDiffThemeName(resolvedTheme),
                preferredHighlighter: PREFERRED_HIGHLIGHTER,
                themeType: resolvedTheme,
                unsafeCSS: EDITOR_UNSAFE_CSS,
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
