import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { memo } from "react";

import type { SidebarThreadSummary } from "~/types";
import { useAbodeActiveRoute, useAbodeSidebar } from "./sidebarContext";
import { subagentOverflow } from "./subagentNesting";

/**
 * Subagents that are running right now, nested under their session as
 * "↳ title" with a live dot. They leave the tree when they finish. The dot is
 * static: nothing in the sidebar repaints continuously.
 */
export const SubagentRows = memo(function SubagentRows(props: {
  readonly subagents: ReadonlyArray<SidebarThreadSummary>;
}) {
  const { navigateToThread } = useAbodeSidebar();
  const { threadKey: activeThreadKey } = useAbodeActiveRoute();
  if (props.subagents.length === 0) return null;
  const { shown, moreCount } = subagentOverflow(props.subagents);
  return (
    <ul className="m-0 p-0" data-testid="sidebar-subagents">
      {shown.map((subagent) => {
        const ref = scopeThreadRef(subagent.environmentId, subagent.id);
        const isActive = activeThreadKey === scopedThreadKey(ref);
        const needsYou = subagent.hasPendingApprovals || subagent.hasPendingUserInput;
        return (
          <li key={subagent.id} className="list-none">
            <button
              type="button"
              data-testid={`subagent-row-${subagent.id}`}
              aria-current={isActive ? "page" : undefined}
              data-active={isActive}
              onClick={() => navigateToThread(ref)}
              data-abode="row subagent"
              className="text-left"
            >
              <span aria-hidden className="shrink-0">
                ↳
              </span>
              <span className="min-w-0 flex-1 truncate">{subagent.title}</span>
              <span
                role="img"
                aria-label={needsYou ? "Needs you" : "Running"}
                data-tone={needsYou ? "needs-you" : "running"}
                data-abode="square dot"
              />
            </button>
          </li>
        );
      })}
      {moreCount > 0 ? (
        <li data-abode="note" className="list-none">
          +{moreCount} more
        </li>
      ) : null}
    </ul>
  );
});
