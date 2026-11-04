import { useState } from "react";

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
import { useEnvironments } from "~/state/environments";
import { useAddMachineStore } from "./addMachineStore";

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

export function AddMachineGuide() {
  const open = useAddMachineStore((state) => state.open);
  const setOpen = useAddMachineStore((state) => state.setOpen);
  const { environments } = useEnvironments();
  const [pairOpen, setPairOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedEnvironments = environments.filter(
    (environment) => environment.entry.target._tag !== "PrimaryConnectionTarget",
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a machine</DialogTitle>
          <DialogDescription>
            Once paired, it shows here as its own machine with its sessions.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <ol className="flex flex-col gap-5">
            <Step n={1} title="Put it on your tailnet">
              <p className="text-sm text-muted-foreground">
                Install Tailscale on it and sign in with the same account.
              </p>
            </Step>
            <Step n={2} title="Start T3 on it">
              <p className="text-sm text-muted-foreground">
                Run this on that machine, or fetch and run it in one go:
              </p>
              <CommandLine command="bash add-machine.sh" />
              <CommandLine command={FETCH_COMMAND} />
            </Step>
            <Step n={3} title="Paste its pairing link">
              <p className="text-sm text-muted-foreground">
                The script prints a one-time link. Paste it here.
              </p>
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
            </Step>
          </ol>
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
