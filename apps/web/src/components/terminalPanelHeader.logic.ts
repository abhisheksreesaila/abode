/** Last folder of a path, either separator, ignoring a trailing one. */
function folderName(path: string): string | null {
  const parts = path.split(/[\\/]+/).filter((part) => part.length > 0);
  return parts.at(-1) ?? null;
}

/**
 * The dim text in the bottom panel header: the active terminal's label and the
 * folder it runs in, `Terminal 1 · abode`. The worktree wins over the project
 * root because that is where the shell actually is.
 */
export function formatTerminalPanelContext(input: {
  readonly label: string | null;
  readonly cwd: string;
  readonly worktreePath?: string | null | undefined;
}): string {
  const folder = folderName(input.worktreePath || input.cwd);
  return [input.label, folder].filter((part): part is string => !!part).join(" · ");
}
