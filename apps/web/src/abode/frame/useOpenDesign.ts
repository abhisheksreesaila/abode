import type { ScopedThreadRef } from "@t3tools/contracts";

import { resolveAssetUrl } from "~/assets/assetUrls";
import { recordVisitForThread } from "~/browserHistoryStore";
import { canOpenLinksInApp, isWebUrl } from "~/browser/browserLinkTarget";
import { openFileInPreview, openUrlInPreview } from "~/browser/openFileInPreview";
import { assetEnvironment } from "~/state/assets";
import { previewEnvironment } from "~/state/preview";
import { readPreparedConnection } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";
import { useAtomQueryRunner } from "~/state/use-atom-query-runner";

import type { DesignCard } from "./designModel";

/**
 * Opens a design card, resolving true when something opened. In T3's browser panel when this
 * client has one; else a link opens in a new tab, and a local docs/design file opens through
 * its asset URL in a new tab. False means nothing could open (the pane then says so).
 * The panel is used whatever `browserLinkTarget` says: Preview is an explicit in-app ask.
 */
export function useOpenDesign(
  threadRef: ScopedThreadRef | null,
  workspaceRoot: string | undefined,
): (card: DesignCard) => Promise<boolean> {
  const openPreview = useAtomCommand(previewEnvironment.open, { reportFailure: false });
  const createAssetUrl = useAtomQueryRunner(assetEnvironment.createUrl, {
    reportFailure: false,
    refresh: true,
  });
  return async (card) => {
    const inApp = threadRef !== null && canOpenLinksInApp(threadRef);
    const newTab = (url: string) => {
      if (!isWebUrl(url)) return false;
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    };
    if (card.href !== null) {
      const href = card.href;
      if (inApp) {
        const result = await openUrlInPreview({ threadRef, url: href, openPreview });
        if (result._tag === "Success") {
          recordVisitForThread(threadRef, href);
          return true;
        }
      }
      return newTab(href);
    }
    if (threadRef === null || card.path === null || workspaceRoot === undefined) return false;
    const connection = readPreparedConnection(threadRef.environmentId);
    if (connection === null) return false;
    const filePath = `${workspaceRoot.replace(/\/$/, "")}/${card.path}`;
    if (inApp) {
      const result = await openFileInPreview({
        threadRef,
        filePath,
        workspaceRoot,
        httpBaseUrl: connection.httpBaseUrl,
        createAssetUrl,
        openPreview,
      });
      if (result._tag === "Success") return true;
    }
    const asset = await createAssetUrl({
      environmentId: threadRef.environmentId,
      input: { resource: { _tag: "workspace-file", threadId: threadRef.threadId, path: filePath } },
    });
    if (asset._tag !== "Success") return false;
    const url = resolveAssetUrl(connection.httpBaseUrl, asset.value.relativeUrl);
    return url !== null && newTab(url);
  };
}
