import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useRouter } from "@tanstack/react-router";

import { buildThreadRouteParams } from "~/threadRoutes";

import type { SessionPill } from "./sessionPills";

/** Opens a session on T3's own chat route for its thread. */
export function useOpenSession() {
  const router = useRouter();
  return (pill: Pick<SessionPill, "environmentId" | "threadId">) =>
    void router.navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(pill.environmentId, pill.threadId)),
    });
}
