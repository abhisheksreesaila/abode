import { ChevronDownIcon, FolderIcon } from "lucide-react";
import type { ReactNode } from "react";

import { projectParentLabel } from "./projectChip";

/**
 * Inside upstream's new-session project trigger: a folder, the project name and a
 * chevron, so the trigger reads as VS Code's project chip. abode.css draws the pill.
 */
export function ProjectChipLabel({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <FolderIcon aria-hidden data-abode-chip-icon="" />
      <span className="min-w-0 truncate">{children}</span>
      <ChevronDownIcon aria-hidden data-abode-chip-icon="" />
    </>
  );
}

/** The project's parent folder in grey, after its name in the picker list. */
export function ProjectPathHint({ workspaceRoot }: { readonly workspaceRoot: string }) {
  const label = projectParentLabel(workspaceRoot);
  return label ? (
    <span className="max-w-40 shrink-0 truncate text-muted-foreground text-xs">{label}</span>
  ) : null;
}
