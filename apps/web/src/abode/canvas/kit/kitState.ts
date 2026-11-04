import { useAtomValue } from "@effect/atom-react";
import { isAtomCommandInterrupted } from "@t3tools/client-runtime/state/runtime";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";
import { useEffect, useState } from "react";

import { useAtomCommand } from "~/state/use-atom-command";

import { customizationsEnvironment } from "../../customizations/customizationsState";
import { parseHooks, parsePlugins, type KitHook, type KitPlugin } from "./kitModel";
import type { CustomizationsScope } from "../../customizations/useCustomizationsScope";

/** Everything the Customizations service lists for the workspace and the user folders. */
export function useKitItems(scope: CustomizationsScope) {
  const result = useAtomValue(
    customizationsEnvironment.list({
      environmentId: scope.environmentId,
      input: { cwd: scope.cwd },
    }),
  );
  return {
    items: Option.getOrNull(AsyncResult.value(result))?.items ?? null,
    failure: result._tag === "Failure" ? Cause.squash(result.cause) : null,
  };
}

/** Hooks and plugins from `~/.claude/settings.json`. Only the parsed rows are kept, never the file text. */
export function useClaudeSettings(scope: CustomizationsScope): {
  readonly hooks: ReadonlyArray<KitHook>;
  readonly plugins: ReadonlyArray<KitPlugin>;
} | null {
  const readFile = useAtomCommand(customizationsEnvironment.readFile, { reportFailure: false });
  const [parsed, setParsed] = useState<{
    readonly hooks: ReadonlyArray<KitHook>;
    readonly plugins: ReadonlyArray<KitPlugin>;
  } | null>(null);
  const { environmentId, cwd } = scope;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reads the user's settings.json from the host once per workspace
  useEffect(() => {
    let cancelled = false;
    void readFile({ environmentId, input: { cwd, path: "~/.claude/settings.json" } }).then(
      (result) => {
        if (cancelled || isAtomCommandInterrupted(result)) return;
        const text = result._tag === "Success" ? result.value.contents : "";
        setParsed({ hooks: parseHooks(text), plugins: parsePlugins(text) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [cwd, environmentId, readFile]);

  return parsed;
}
