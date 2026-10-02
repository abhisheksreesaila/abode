import type { EnvironmentId } from "@t3tools/contracts";
import { useMemo } from "react";

import { useProjectFileQuery } from "../files/projectFilesQueryState";
import { parseReadmeWelcome, type ReadmeWelcome } from "./projectWelcome.logic";

const README_PATH = "README.md";

// Parsed READMEs by project, kept for the life of the page: the hero is shown
// again for every new thread, and a README does not change between them.
// Failures are not cached, so a project that was offline gets another try.
const parsedReadmeByProject = new Map<string, ReadmeWelcome>();

/**
 * The project's README emoji and tagline, read through the existing
 * projects.readFile query (no new server code). Null while loading and when
 * there is no readable README, so the caller falls back to the plain headline.
 */
export function useProjectReadmeWelcome(project: {
  readonly environmentId: EnvironmentId;
  readonly workspaceRoot: string;
}): ReadmeWelcome | null {
  const key = `${project.environmentId}:${project.workspaceRoot}`;
  const cached = parsedReadmeByProject.get(key) ?? null;
  const query = useProjectFileQuery(
    project.environmentId,
    project.workspaceRoot,
    README_PATH,
    cached === null,
  );
  const contents = query.data?.contents ?? null;

  return useMemo(() => {
    if (cached !== null) return cached;
    if (contents === null) return null;
    const parsed = parseReadmeWelcome(contents);
    parsedReadmeByProject.set(key, parsed);
    return parsed;
  }, [cached, contents, key]);
}
