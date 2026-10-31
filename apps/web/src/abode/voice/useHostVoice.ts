import {
  createEnvironmentRpcCommand,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { WS_METHODS, type VoiceStatus } from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";

import { connectionAtomRuntime } from "~/connection/runtime";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { useAtomCommand } from "~/state/use-atom-command";
import { createHostDictation, type HostDictation, type VoiceCall } from "./hostDictation";

const voiceSession = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:voice:session",
  tag: WS_METHODS.voice,
});

/** While the host downloads its model, ask how far along it is this often. */
const DOWNLOAD_POLL_MS = 1_000;

export interface HostVoice {
  /** What the connected host says about its speech model; null when it has none (or is older). */
  readonly status: VoiceStatus | null;
  /** True once the first answer (or failure) is in. */
  readonly known: boolean;
  /** Asks the host again; resolves with the fresh status. */
  readonly refresh: () => Promise<VoiceStatus | null>;
  /** Starts the model download on the host if it is missing. */
  readonly prepare: () => Promise<VoiceStatus | null>;
  /** A dictation that streams to the host. Use only while `status.model` is `ready`. */
  readonly begin: () => HostDictation;
}

/**
 * The connected environment's host voice. Audio goes to the host over the same connection as
 * everything else, so a remote browser dictates on the machine that runs the server. An older
 * server doesn't know the `voice.session` method and answers with an error, which reads as
 * "no host voice".
 */
export function useHostVoice(): HostVoice {
  const environmentId = usePrimaryEnvironmentId();
  const run = useAtomCommand(voiceSession, { reportFailure: false, reportDefect: false });
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [known, setKnown] = useState(false);
  const mounted = useRef(true);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tracks mount so host voice requests that settle after unmount skip their state updates
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const call: VoiceCall = async (input) => {
    if (environmentId === null) throw new Error("Not connected to a host.");
    const result = await run({ environmentId, input });
    if (result._tag === "Success") return result.value;
    const failure = squashAtomCommandFailure(result);
    throw failure instanceof Error ? failure : new Error("The host voice request failed.");
  };

  const ask = async (op: "status" | "prepare") => {
    let next: VoiceStatus | null = null;
    try {
      const result = await call({ op });
      if (result.op === "status") next = result.status;
    } catch {
      next = null;
    }
    if (mounted.current) {
      setStatus(next);
      setKnown(true);
    }
    return next;
  };
  const refresh = () => ask("status");
  const prepare = () => ask("prepare");

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- asks the host for voice status on mount and on window focus
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const downloading = status?.model === "downloading";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- interval that polls the host while its voice model downloads
  useEffect(() => {
    if (!downloading) return;
    const timer = setInterval(() => void refresh(), DOWNLOAD_POLL_MS);
    return () => clearInterval(timer);
  }, [downloading, refresh]);

  const begin = () => createHostDictation(call);
  return { status, known, refresh, prepare, begin };
}
