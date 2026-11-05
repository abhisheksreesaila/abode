import { AuthPreviewOperateScope, type ScopedThreadRef } from "@t3tools/contracts";

import { recordVisitForThread } from "~/browserHistoryStore";
import { canOpenLinksInApp, isWebUrl } from "~/browser/browserLinkTarget";
import { openFileInPreview, openUrlInPreview } from "~/browser/openFileInPreview";
import { assetEnvironment } from "~/state/assets";
import { previewEnvironment } from "~/state/preview";
import { readEnvironmentScope, readPreparedConnection } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";
import { useAtomQueryRunner } from "~/state/use-atom-query-runner";

import type { DesignCard } from "./designModel";

/**
 * Opens a design card in T3's browser panel when this client has one (a link, or a local
 * docs/design file served through the asset route). Otherwise a link opens in a new tab and a
 * file stays as its path on the card.
 */
export function useOpenDesign(
  threadRef: ScopedThreadRef | null,
  workspaceRoot: string | undefined,
): (card: DesignCard) => void {
  const openPreview = useAtomCommand(previewEnvironment.open, { reportFailure: false });
  const createAssetUrl = useAtomQueryRunner(assetEnvironment.createUrl, {
    reportFailure: false,
    refresh: true,
  });
  return (card) => {
    const inApp =
      threadRef !== null &&
      canOpenLinksInApp(threadRef) &&
      readEnvironmentScope(threadRef.environmentId, AuthPreviewOperateScope);
    const fallback = () => {
      if (card.href !== null && isWebUrl(card.href)) {
        window.open(card.href, "_blank", "noopener,noreferrer");
      }
    };
    if (!inApp) return fallback();
    if (card.href !== null) {
      void openUrlInPreview({ threadRef, url: card.href, openPreview }).then((result) => {
        if (result._tag === "Success") recordVisitForThread(threadRef, card.href as string);
        else fallback();
      });
      return;
    }
    const connection = readPreparedConnection(threadRef.environmentId);
    if (card.path === null || workspaceRoot === undefined || connection === null) return;
    void openFileInPreview({
      threadRef,
      filePath: `${workspaceRoot.replace(/\/$/, "")}/${card.path}`,
      workspaceRoot,
      httpBaseUrl: connection.httpBaseUrl,
      createAssetUrl,
      openPreview,
    });
  };
}
