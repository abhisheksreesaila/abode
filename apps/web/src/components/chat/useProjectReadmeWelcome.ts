import type { EnvironmentId } from "@t3tools/contracts";
import { useEffect, useMemo } from "react";

import { useProjectFileQuery } from "../files/projectFilesQueryState";
import { parseReadmeWelcome, type ReadmeWelcome } from "./projectWelcome.logic";

const README_PATH = "README.md";

// Last parsed README per project, kept for the life of the page so the hero's
// tagline is there at first paint for the next thread. It is only a
// placeholder: the query always runs and its contents win when they arrive.
// Failures are not cached.
const parsedReadmeByProject = new Map<string, ReadmeWelcome>();

/**
 * The project's README emoji and tagline, read through the existing
 * projects.readFile query (no new server code). Null until a README has been
 * read, and when there is none; the hero renders without them.
 */
export function useProjectReadmeWelcome(project: {
  readonly environmentId: EnvironmentId;
  readonly workspaceRoot: string;
}): ReadmeWelcome | null {
  const key = `${project.environmentId}:${project.workspaceRoot}`;
  const query = useProjectFileQuery(project.environmentId, project.workspaceRoot, README_PATH);
  const contents = query.data?.contents ?? null;

  const parsed = useMemo(
    () => (contents === null ? null : parseReadmeWelcome(contents)),
    [contents],
  );
  // A read that fails or finds no README means the cached tagline is stale.
  const readFailed = contents === null && query.error !== null;
  useEffect(() => {
    if (parsed !== null) parsedReadmeByProject.set(key, parsed);
    else if (readFailed) parsedReadmeByProject.delete(key);
  }, [key, parsed, readFailed]);

  return parsed ?? (readFailed ? null : (parsedReadmeByProject.get(key) ?? null));
}
