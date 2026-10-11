import type {
  CustomizationHarness,
  CustomizationKind,
  CustomizationScope,
} from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useId, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { Toggle, ToggleGroup } from "~/components/ui/toggle-group";
import { useAtomCommand } from "~/state/use-atom-command";

import { describeCustomizationsError, displayCustomizationPath } from "./customizationsModel";
import { customizationsEnvironment } from "./customizationsState";
import {
  availableScopes,
  coerceScope,
  nameProblem,
  needsName,
  planNewCustomization,
} from "./newCustomization";
import type { CustomizationsScope } from "./useCustomizationsScope";

const KIND_NOUN: Record<CustomizationKind, string> = {
  skill: "skill",
  agent: "agent",
  mcp: "MCP servers file",
  instructions: "instructions file",
};

/**
 * The "+" on a Customizations folder. A skill or agent takes a name and a place (this workspace
 * or all workspaces); instructions and MCP files have a fixed place and are opened when they
 * already exist. The file is written from its template, then opened in the side panel.
 */
export function NewCustomizationDialog(props: {
  readonly scope: CustomizationsScope;
  readonly kind: CustomizationKind;
  readonly defaultHarness: CustomizationHarness;
  readonly onClose: () => void;
  /** Called with the absolute path to open once the file exists. */
  readonly onReady: (path: string) => void;
}) {
  const { scope, kind, defaultHarness, onClose, onReady } = props;
  const id = useId();
  const readFile = useAtomCommand(customizationsEnvironment.readFile, { reportFailure: false });
  const writeFile = useAtomCommand(customizationsEnvironment.writeFile, { reportFailure: false });
  const [name, setName] = useState("");
  const [harness, setHarness] = useState<CustomizationHarness>(defaultHarness);
  const [chosenScope, setChosenScope] = useState<CustomizationScope>("workspace");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopes = availableScopes(kind, harness);
  const effectiveScope = coerceScope(kind, harness, chosenScope);
  const plan = useMemo(
    () => planNewCustomization({ kind, harness, scope: effectiveScope, name, cwd: scope.cwd }),
    [effectiveScope, harness, kind, name, scope.cwd],
  );
  const problem = nameProblem(kind, name);
  const target = plan ? displayCustomizationPath(plan.path, scope.cwd) : null;

  const create = async () => {
    setTouched(true);
    if (!plan || problem !== null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const input = { cwd: scope.cwd, path: plan.path };
      if (plan.openIfExists) {
        const existing = await readFile({ environmentId: scope.environmentId, input });
        if (existing._tag === "Success") {
          onReady(existing.value.path);
          return;
        }
        if (isAtomCommandInterrupted(existing)) return;
        if (plan.readOnly) {
          setError(`${target ?? plan.path} does not exist yet, and abode can't create it.`);
          return;
        }
      }
      const written = await writeFile({
        environmentId: scope.environmentId,
        input: {
          ...input,
          contents: plan.contents,
          ...(plan.openIfExists ? {} : { createOnly: true }),
        },
      });
      if (written._tag === "Success") {
        toastManager.add(
          stackedThreadToast({
            type: "success",
            title: `Created ${KIND_NOUN[kind]}`,
            description: target ?? undefined,
            timeout: 3500,
          }),
        );
        onReady(written.value.path);
        return;
      }
      if (isAtomCommandInterrupted(written)) return;
      setError(describeCustomizationsError(squashAtomCommandFailure(written)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <DialogHeader>
            <DialogTitle>New {KIND_NOUN[kind]}</DialogTitle>
            <DialogDescription>
              {needsName(kind)
                ? "Starts from a template you can edit in the side panel."
                : "Opens the file, creating it first if it is missing."}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-4">
              {needsName(kind) ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-name`}>Name</Label>
                  <Input
                    id={`${id}-name`}
                    nativeInput
                    autoFocus
                    autoComplete="off"
                    placeholder={kind === "skill" ? "deploy-helper" : "code-reviewer"}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  {touched && problem ? (
                    <p role="alert" className="text-xs text-destructive">
                      {problem}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <Label>For</Label>
                <ToggleGroup
                  aria-label="Harness"
                  className="w-full *:flex-1"
                  value={[harness]}
                  onValueChange={(next) => {
                    const value = next[0];
                    if (value === "claude" || value === "codex") setHarness(value);
                  }}
                >
                  <Toggle value="claude">Claude</Toggle>
                  <Toggle value="codex">Codex</Toggle>
                </ToggleGroup>
              </div>
              {scopes.length > 1 ? (
                <div className="flex flex-col gap-1.5">
                  <Label>Where</Label>
                  <ToggleGroup
                    aria-label="Scope"
                    className="w-full *:flex-1"
                    value={[effectiveScope]}
                    onValueChange={(next) => {
                      const value = next[0];
                      if (value === "workspace" || value === "user") setChosenScope(value);
                    }}
                  >
                    <Toggle value="workspace">This workspace</Toggle>
                    <Toggle value="user">All workspaces</Toggle>
                  </ToggleGroup>
                </div>
              ) : null}
              {target ? (
                <p className="truncate font-mono text-xs text-muted-foreground">{target}</p>
              ) : null}
              {error ? (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || (touched && problem !== null)}>
              {needsName(kind) ? "Create" : "Open"}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
