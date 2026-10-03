import type {
  CustomizationHarness,
  CustomizationKind,
  CustomizationScope,
} from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useMemo, useState } from "react";

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
import { Textarea } from "~/components/ui/textarea";
import { Toggle, ToggleGroup } from "~/components/ui/toggle-group";
import { customizationsEnvironment } from "~/state/customizations";
import { useAtomCommand } from "~/state/use-atom-command";

import { describeCustomizationsError } from "./customizationsModel";
import { availableScopes, coerceScope, needsName, planNewCustomization } from "./newCustomization";
import type { CustomizationsScope } from "./CustomizationsSection";

const KIND_NOUN: Record<CustomizationKind, string> = {
  skill: "skill",
  agent: "agent",
  instructions: "instructions file",
  mcp: "MCP file",
};

const SCOPE_LABEL: Record<CustomizationScope, string> = {
  workspace: "This workspace",
  user: "All workspaces",
};

function fixedFileNote(kind: CustomizationKind, harness: CustomizationHarness): string | null {
  if (kind === "agent" && harness === "codex") {
    return "Codex has no agents; this creates a custom prompt in ~/.codex/prompts.";
  }
  if (kind === "instructions") {
    const file = harness === "codex" ? "AGENTS.md" : "CLAUDE.md";
    return `Creates ${file} if it is missing; an existing file just opens.`;
  }
  if (kind === "mcp") {
    return harness === "codex"
      ? "Codex declares MCP servers in ~/.codex/config.toml. It opens read-only: edit it outside abode."
      : "Opens .mcp.json in the workspace root, creating it if it is missing.";
  }
  return null;
}

/**
 * The "+" on a Customizations folder (abode F-043): name, harness, scope and an editable
 * template. Save writes through `customizations.writeFile`, refreshes the list and opens the file.
 */
export function NewCustomizationDialog({
  scope,
  kind,
  defaultHarness,
  open,
  onOpenChange,
  onSaved,
}: {
  readonly scope: CustomizationsScope;
  readonly kind: CustomizationKind;
  readonly defaultHarness: CustomizationHarness;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Called with the absolute path of the file to show, after the list should refresh. */
  readonly onSaved: (path: string) => void;
}) {
  const readFile = useAtomCommand(customizationsEnvironment.readFile, { reportFailure: false });
  const writeFile = useAtomCommand(customizationsEnvironment.writeFile, { reportFailure: false });
  const [name, setName] = useState("");
  const [harness, setHarness] = useState<CustomizationHarness>(defaultHarness);
  const [scopeChoice, setScopeChoice] = useState<CustomizationScope>("workspace");
  const [edited, setEdited] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveScope = coerceScope(kind, harness, scopeChoice);
  const scopes = availableScopes(kind, harness);
  const plan = useMemo(
    () => planNewCustomization({ kind, harness, scope: effectiveScope, name, cwd: scope.cwd }),
    [effectiveScope, harness, kind, name, scope.cwd],
  );
  const contents = edited ?? plan?.contents ?? "";
  const note = fixedFileNote(kind, harness);

  const save = async () => {
    if (!plan || busy) return;
    setBusy(true);
    setError(null);
    try {
      const input = { cwd: scope.cwd, path: plan.path };
      const existing = await readFile({ environmentId: scope.environmentId, input });
      if (existing._tag === "Success") {
        if (!plan.openIfExists) {
          setError(`${plan.path} already exists. Pick another name.`);
          return;
        }
        onSaved(existing.value.path);
        onOpenChange(false);
        return;
      }
      if (isAtomCommandInterrupted(existing)) return;
      if (plan.readOnly) {
        setError(`${plan.path} does not exist yet, and abode can't create it.`);
        return;
      }
      const written = await writeFile({
        environmentId: scope.environmentId,
        input: { ...input, contents },
      });
      if (written._tag === "Success") {
        onSaved(written.value.path);
        onOpenChange(false);
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
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setName("");
          setEdited(null);
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New {KIND_NOUN[kind]}</DialogTitle>
          <DialogDescription>{scope.projectName}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="flex flex-col gap-3">
            {needsName(kind) ? (
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-foreground">Name</span>
                <Input
                  aria-label="Name"
                  autoFocus
                  placeholder="deploy-helper"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setEdited(null);
                    setError(null);
                  }}
                />
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">Harness</span>
              <ToggleGroup
                aria-label="Harness"
                value={[harness]}
                onValueChange={(next) => {
                  const value = next[0];
                  if (value === "claude" || value === "codex") {
                    setHarness(value);
                    setEdited(null);
                    setError(null);
                  }
                }}
              >
                <Toggle value="claude">Claude</Toggle>
                <Toggle value="codex">Codex</Toggle>
              </ToggleGroup>
            </div>
            {scopes.length > 1 ? (
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-foreground">Scope</span>
                <ToggleGroup
                  aria-label="Scope"
                  value={[effectiveScope]}
                  onValueChange={(next) => {
                    const value = next[0];
                    if (value === "workspace" || value === "user") {
                      setScopeChoice(value);
                      setEdited(null);
                      setError(null);
                    }
                  }}
                >
                  {scopes.map((option) => (
                    <Toggle key={option} value={option}>
                      {SCOPE_LABEL[option]}
                    </Toggle>
                  ))}
                </ToggleGroup>
              </div>
            ) : null}
            {plan ? (
              <p className="text-xs break-all text-muted-foreground">
                Writes <code>{plan.path.replace(`${scope.cwd.replace(/\/+$/, "")}/`, "")}</code>
              </p>
            ) : null}
            {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
            {plan && !plan.readOnly ? (
              <div className="grid gap-1.5">
                <span className="text-xs font-medium text-foreground">Template</span>
                <Textarea
                  aria-label="Template"

                  rows={9}
                  value={contents}
                  onChange={(event) => setEdited(event.target.value)}
                />
              </div>
            ) : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!plan || busy} onClick={() => void save()}>
            {plan?.readOnly ? "Open" : "Save"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
