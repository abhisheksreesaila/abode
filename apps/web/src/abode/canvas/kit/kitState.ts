import { useAtomValue } from "@effect/atom-react";
import { isAtomCommandInterrupted } from "@t3tools/client-runtime/state/runtime";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";
import { useEffect, useState } from "react";

import { useAtomCommand } from "~/state/use-atom-command";

import { customizationsEnvironment } from "../../customizations/customizationsState";
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

/** Text of `~/.claude/settings.json`: null while loading, "" when it can't be read. */
export function useClaudeSettings(scope: CustomizationsScope): string | null {
  const readFile = useAtomCommand(customizationsEnvironment.readFile, { reportFailure: false });
  const [text, setText] = useState<string | null>(null);
  const { environmentId, cwd } = scope;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reads the user's settings.json from the host once per workspace
  useEffect(() => {
    let cancelled = false;
    void readFile({ environmentId, input: { cwd, path: "~/.claude/settings.json" } }).then(
      (result) => {
        if (cancelled || isAtomCommandInterrupted(result)) return;
        setText(result._tag === "Success" ? result.value.contents : "");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [cwd, environmentId, readFile]);

  return text;
}
