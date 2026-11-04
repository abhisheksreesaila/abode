import { useEffect, useState } from "react";

import { FRESH_MS, newKeys } from "./freshMoment";

interface Seen {
  readonly scope: string;
  readonly keys: ReadonlyArray<string> | null;
  readonly fresh: string | null;
}

/**
 * The key of an item that just appeared in `keys` (spec 5.11), for the focus moment, until it
 * clears. A different `scope` (another workspace) starts over without a moment.
 */
export function useFreshMoment(
  scope: string,
  keys: ReadonlyArray<string>,
  onAdded?: (key: string) => void,
): string | null {
  const [seen, setSeen] = useState<Seen>({ scope, keys: null, fresh: null });
  const joined = keys.join("\u0000");
  if (seen.scope !== scope || (seen.keys?.join("\u0000") ?? null) !== joined) {
    const added = seen.scope === scope ? newKeys(seen.keys, keys) : [];
    const key = added[0];
    setSeen({ scope, keys, fresh: key ?? (seen.scope === scope ? seen.fresh : null) });
    if (key !== undefined) onAdded?.(key);
  }
  const { fresh } = seen;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- clears the focus moment on a timer
  useEffect(() => {
    if (fresh === null) return;
    const timer = setTimeout(() => setSeen((current) => ({ ...current, fresh: null })), FRESH_MS);
    return () => clearTimeout(timer);
  }, [fresh]);
  return fresh;
}
