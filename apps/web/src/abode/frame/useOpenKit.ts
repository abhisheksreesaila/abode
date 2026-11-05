import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { findProjectByPath } from "@t3tools/client-runtime/state/projects";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { newProjectId } from "~/lib/utils";
import { readProjects, readThreadShells } from "~/state/entities";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { projectEnvironment } from "~/state/projects";
import { useAtomQueryRunner } from "~/state/use-atom-query-runner";
import { useAtomCommand } from "~/state/use-atom-command";

import { useOpenSession } from "../canvas/useOpenSession";
import { skillUsageAtom } from "./kitData";

const KIT_TITLE = "Kit";

function fail(description: string) {
  toastManager.add(
    stackedThreadToast({ type: "error", title: "Could not open the Kit", description }),
  );
}

/**
 * Opens the Kit: the latest thread of the project rooted at the host's home folder, a new thread
 * there when it has none. The project is added (titled "Kit") the first time.
 */
export function useOpenKit() {
  const environmentId = usePrimaryEnvironmentId();
  const loadHome = useAtomQueryRunner(skillUsageAtom, {
    reportFailure: false,
    reportDefect: false,
  });
  const createProject = useAtomCommand(projectEnvironment.create, { reportFailure: false });
  const handleNewThread = useNewThreadHandler();
  const openSession = useOpenSession();

  return async () => {
    if (environmentId === null) return fail("No machine is connected yet.");
    const home = await loadHome({ environmentId, input: { scan: false } });
    if (home._tag === "Failure") {
      if (!isAtomCommandInterrupted(home)) fail("The host's home folder could not be read.");
      return;
    }
    const homePath = home.value.homePath;
    let project = findProjectByPath(
      readProjects().filter((candidate) => candidate.environmentId === environmentId),
      homePath,
    );
    let projectId = project?.id;
    if (projectId === undefined) {
      projectId = newProjectId();
      const created = await createProject({
        environmentId,
        input: {
          projectId,
          title: KIT_TITLE,
          workspaceRoot: homePath,
          createWorkspaceRootIfMissing: false,
          defaultModelSelection: null,
        },
      });
      if (created._tag === "Failure") {
        if (!isAtomCommandInterrupted(created)) {
          const error = squashAtomCommandFailure(created);
          fail(error instanceof Error ? error.message : "The Kit project could not be added.");
        }
        return;
      }
    }
    const latest = readThreadShells()
      .filter(
        (thread) =>
          thread.environmentId === environmentId &&
          thread.projectId === projectId &&
          thread.archivedAt === null &&
          thread.forkedFrom?.type !== "run",
      )
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (latest !== undefined) return openSession({ environmentId, threadId: latest.id });
    await handleNewThread(scopeProjectRef(environmentId, projectId)).catch((error: unknown) =>
      fail(error instanceof Error ? error.message : "A Kit thread could not be started."),
    );
  };
}
