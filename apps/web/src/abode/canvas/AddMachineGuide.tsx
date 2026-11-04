import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { useEffect, useState } from "react";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { AddEnvironmentDialog } from "~/components/settings/AddEnvironmentDialog";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { useAddMachineStore } from "./addMachineStore";
import { macState, tailnetRows, type TailnetRow } from "./tailnetModel";
import { tailnetStatusAtom } from "./tailnetState";

const FETCH_COMMAND =
  "curl -fsSL https://raw.githubusercontent.com/abhisheksreesaila/abode/abode-next/scripts/abode/add-machine.sh | bash";

function CommandLine({ command }: { readonly command: string }) {
  const { copyToClipboard, isCopied } = useCopyToClipboard({ target: "command" });
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted p-2">
      <code className="min-w-0 flex-1 break-all font-mono text-xs">{command}</code>
      <Button size="xs" variant="outline" onClick={() => copyToClipboard(command, undefined)}>
        {isCopied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  readonly n: number;
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <b className="text-sm font-medium">{title}</b>
        {children}
      </div>
    </li>
  );
}

function TailnetList({ rows }: { readonly rows: ReadonlyArray<TailnetRow> }) {
  return (
    <ul className="flex flex-col gap-1 rounded-lg bg-muted p-2 text-sm">
      {rows.map((row) => (
        <li key={row.name} className="flex items-center gap-2">
          <span
            role="img"
            aria-label={row.online ? "online" : "offline"}
            className={`size-2 shrink-0 rounded-full ${row.online ? "bg-success" : "bg-muted-foreground/40"}`}
          />
          <span className="min-w-0 flex-1 truncate">{row.name}</span>
          <span className="text-xs text-muted-foreground">{row.os}</span>
          {row.inAbode ? <span className="text-xs text-muted-foreground">in abode</span> : null}
        </li>
      ))}
    </ul>
  );
}

function GuideBody({ hostId }: { readonly hostId: EnvironmentId }) {
  const { environments } = useEnvironments();
  const [pairOpen, setPairOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const atom = tailnetStatusAtom({ environmentId: hostId, input: undefined });
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const status = Option.getOrNull(AsyncResult.value(result));
  const savedEnvironments = environments.filter(
    (environment) => environment.entry.target._tag !== "PrimaryConnectionTarget",
  );

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- re-reads the host tailnet each time the guide opens (the body mounts only while open)
  useEffect(() => {
    refresh();
  }, [refresh]);

  const rows = status
    ? tailnetRows(
        status,
        environments.map((environment) => environment.label),
      )
    : [];
  const mac = status ? macState(status, rows) : { kind: "unknown" as const };
  const pairing = (
    <div>
      <AddEnvironmentDialog
        open={pairOpen}
        routeTarget={null}
        error={error}
        savedEnvironments={savedEnvironments}
        onOpenChange={(next) => {
          setPairOpen(next);
          if (!next) setError(null);
        }}
        onErrorChange={setError}
      />
    </div>
  );

  return (
    <DialogPanel>
      <section className="mb-5 flex flex-col gap-2" aria-label="Your tailnet">
        <div className="flex items-center gap-2">
          <b className="flex-1 text-sm font-medium">Your tailnet</b>
          <Button size="xs" variant="outline" onClick={refresh}>
            Check again
          </Button>
        </div>
        {status?.available ? (
          <TailnetList rows={rows} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {status ? "Tailscale isn't running on this host." : "Checking…"}
          </p>
        )}
        {mac.kind === "none" ? (
          <p className="text-sm font-medium">No Mac on your tailnet yet</p>
        ) : null}
        {mac.kind === "connected" ? (
          <p className="text-sm font-medium">{mac.name} is connected</p>
        ) : null}
      </section>
      {mac.kind === "connected" ? null : mac.kind === "found" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Found {mac.name}</p>
          <p className="text-sm text-muted-foreground">
            Run the script on it, then paste its pairing link.
          </p>
          <CommandLine command={FETCH_COMMAND} />
          {pairing}
        </div>
      ) : (
        <ol className="flex flex-col gap-5">
          <Step n={1} title="Put it on your tailnet">
            <p className="text-sm text-muted-foreground">
              Install Tailscale on it (App Store on a Mac) and sign in with the same account.
            </p>
          </Step>
          <Step n={2} title="Start T3 on it">
            <p className="text-sm text-muted-foreground">Run this in Terminal on that machine:</p>
            <CommandLine command={FETCH_COMMAND} />
          </Step>
          <Step n={3} title="Paste its pairing link">
            <p className="text-sm text-muted-foreground">
              Paste the one-time link it prints. Then press Check again.
            </p>
            {pairing}
          </Step>
        </ol>
      )}
    </DialogPanel>
  );
}

export function AddMachineGuide() {
  const open = useAddMachineStore((state) => state.open);
  const setOpen = useAddMachineStore((state) => state.setOpen);
  const hostId = usePrimaryEnvironmentId();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a machine</DialogTitle>
          <DialogDescription>
            Once paired, it shows here as its own machine with its sessions.
          </DialogDescription>
        </DialogHeader>
        {hostId && open ? <GuideBody hostId={hostId} /> : null}
      </DialogPopup>
    </Dialog>
  );
}
