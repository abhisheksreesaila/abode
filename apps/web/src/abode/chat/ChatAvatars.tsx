import { useAtomValue } from "@effect/atom-react";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useLayoutEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { deriveProviderInstanceEntries } from "~/providerInstances";
import { primaryServerProvidersAtom } from "~/state/server";
import { useThreadShell } from "~/state/entities";

import { BossAvatar, HelperAvatar, type Helper } from "./cast/Characters";
import { useCastStore } from "./cast/castStore";

function helperFor(driverKind: string | undefined): Helper {
  return driverKind === "codex" ? "pip" : "sunny";
}

/**
 * The avatars beside the timeline's messages. Rendered next to the chat column; the drawings
 * stay hidden here and are handed to the shared container as CSS variables, which chat.css
 * paints beside each message. Server threads only, with abode chat on.
 */
export function ChatAvatars(props: { readonly threadRef: ScopedThreadRef | null }) {
  const enabled = useCastStore((state) => state.enabled);
  if (!enabled || props.threadRef === null) return null;
  return <Avatars threadRef={props.threadRef} />;
}

function Avatars({ threadRef }: { readonly threadRef: ScopedThreadRef }) {
  const shell = useThreadShell(threadRef);
  const providers = useAtomValue(primaryServerProvidersAtom);
  const cast = useCastStore(
    useShallow((state) => ({
      look: state.look,
      photo: state.photo,
      bossName: state.bossName,
      claudeName: state.claudeName,
      codexName: state.codexName,
    })),
  );
  const drawingsRef = useRef<HTMLDivElement>(null);

  const helper = helperFor(
    shell
      ? deriveProviderInstanceEntries(providers).find(
          (entry) => entry.instanceId === shell.modelSelection.instanceId,
        )?.driverKind
      : undefined,
  );
  const helperName = helper === "pip" ? cast.codexName : cast.claudeName;

  // The signature changes whenever a drawing does, which re-reads the hidden copies.
  const drawingSignature = JSON.stringify([helper, cast, helperName]);
  const handedOver = useRef("");
  useLayoutEffect(() => {
    const host = drawingsRef.current?.parentElement;
    const drawings = drawingsRef.current?.children;
    if (!host || !drawings || drawings.length < 2 || handedOver.current === drawingSignature)
      return;
    handedOver.current = drawingSignature;
    const asUrl = (element: Element) =>
      element instanceof HTMLImageElement
        ? `url("${element.src}")`
        : `url("data:image/svg+xml,${encodeURIComponent(
            element.outerHTML.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'),
          )}")`;
    host.style.setProperty("--abode-helper-avatar", asUrl(drawings[0]!));
    host.style.setProperty("--abode-boss-avatar", asUrl(drawings[1]!));
  }, [drawingSignature]);
  useLayoutEffect(() => {
    const host = drawingsRef.current?.parentElement;
    return () => {
      // Reset so React's dev double-mount hands the drawings over again.
      handedOver.current = "";
      host?.style.removeProperty("--abode-helper-avatar");
      host?.style.removeProperty("--abode-boss-avatar");
    };
  }, []);

  return (
    <div ref={drawingsRef} hidden>
      <HelperAvatar helper={helper} name={helperName} />
      <BossAvatar look={cast.look} photo={cast.photo} name={cast.bossName} />
    </div>
  );
}
