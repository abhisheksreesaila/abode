import type { PullRequestListInput, ScopedThreadRef } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRightIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

import { useEnvironments } from "~/state/environments";
import { usePullRequestList } from "~/state/pullRequests";
import { useRightPanelStore } from "~/rightPanelStore";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { PullRequestListGhost } from "./PullRequestGhosts";
import { readPullRequestListPreferences } from "./pullRequestListPreferences";
import { pullRequestEntryKey } from "./pullRequestList.logic";
import { PullRequestRow, type PullRequestRowTarget } from "./PullRequestRow";
import { PullRequestsUnavailableState } from "./PullRequestsUnavailableState";

const DRAWER_LIST_LIMIT = 50;
const OPEN_PULL_REQUESTS: PullRequestListInput = { state: "open", limit: DRAWER_LIST_LIMIT };

/**
 * The workspace's open pull requests as a right-drawer tab (abode F-049). It reads the same
 * list query the /pull-requests page does, across every connected server that offers pull
 * requests, and a row opens its detail as a peer `pull-request` tab in this drawer. Filters,
 * search and grouping stay on the page, which the footer link opens.
 */
export function PullRequestListPanel({ threadRef }: { threadRef: ScopedThreadRef }) {
  const navigate = useNavigate();
  const { environments } = useEnvironments();
  const capableEnvironmentIds = useMemo(
    () =>
      environments
        .filter(
          (environment) => environment.serverConfig?.environment.capabilities.pullRequests === true,
        )
        .map((environment) => environment.environmentId)
        .toSorted((left, right) => left.localeCompare(right)),
    [environments],
  );
  const targets = useMemo(
    () =>
      capableEnvironmentIds.map((environmentId) => ({
        environmentId,
        input: OPEN_PULL_REQUESTS,
      })),
    [capableEnvironmentIds],
  );
  const query = usePullRequestList(targets);
  const environmentLabels = useMemo(
    () =>
      new Map(
        environments.map((environment) => [environment.environmentId, environment.label] as const),
      ),
    [environments],
  );
  const selectEntry = useCallback(
    (entry: PullRequestRowTarget) =>
      useRightPanelStore.getState().openPullRequest(threadRef, entry),
    [threadRef],
  );
  const openPage = useCallback(
    () => void navigate({ to: "/pull-requests", search: readPullRequestListPreferences() }),
    [navigate],
  );
  const entries = query.data?.entries ?? [];
  const showProvider = new Set(entries.map((entry) => entry.provider)).size > 1;

  let body;
  if (capableEnvironmentIds.length === 0) {
    body = (
      <PullRequestsUnavailableState
        title="Pull requests are unavailable"
        error="No connected server offers pull requests."
      />
    );
  } else if (query.data === null && query.error !== null) {
    body = <PullRequestsUnavailableState error={query.error} onRetry={() => query.refresh()} />;
  } else if (query.data === null) {
    body = <PullRequestListGhost />;
  } else if (entries.length === 0) {
    body = (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">No open pull requests.</p>
    );
  } else {
    body = (
      <div role="list" className="flex flex-col py-1">
        {entries.map((entry) => (
          <PullRequestRow
            key={pullRequestEntryKey(entry)}
            entry={entry}
            selected={false}
            showProjectTitle
            showProvider={showProvider}
            {...(capableEnvironmentIds.length > 1 &&
            environmentLabels.get(entry.environmentId) !== undefined
              ? { environmentLabel: environmentLabels.get(entry.environmentId)! }
              : {})}
            onSelect={selectEntry}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">{body}</ScrollArea>
      <div className="flex shrink-0 items-center justify-end border-t px-2 py-1.5">
        <Button size="xs" variant="ghost-muted" onClick={openPage}>
          Open full page
          <ArrowUpRightIcon />
        </Button>
      </div>
    </div>
  );
}
