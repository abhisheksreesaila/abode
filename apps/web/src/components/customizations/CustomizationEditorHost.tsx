import { Suspense, lazy, useCallback } from "react";

import { useCustomizationEditorStore } from "~/customizationEditorStore";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { customizationsEnvironment } from "~/state/customizations";

// Loaded on first open so the pierre editor stays out of the root bundle.
const CustomizationEditorDialog = lazy(() =>
  import("./CustomizationEditor").then((module) => ({ default: module.CustomizationEditorDialog })),
);

/** Mounted once at the app root: renders whichever customization editor the store has open. */
export function CustomizationEditorHost() {
  const open = useCustomizationEditorStore((state) => state.open);
  const closeEditor = useCustomizationEditorStore((state) => state.closeEditor);
  const scope = open?.scope;
  const onChanged = useCallback(() => {
    if (!scope) return;
    appAtomRegistry.refresh(
      customizationsEnvironment.list({
        environmentId: scope.environmentId,
        input: { cwd: scope.cwd },
      }),
    );
  }, [scope]);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <CustomizationEditorDialog
        // A fresh session per target, so reopening starts from the file on disk.
        key={open.target.type === "edit" ? open.target.path : `new:${open.target.kind}`}
        scope={open.scope}
        target={open.target}
        onClose={closeEditor}
        onChanged={onChanged}
      />
    </Suspense>
  );
}
