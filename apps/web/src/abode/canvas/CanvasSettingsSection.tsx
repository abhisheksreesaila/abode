import { Switch } from "../../components/ui/switch";
import { SettingsRow, SettingsSection } from "../../components/settings/settingsLayout";
import { useCanvasStore } from "./canvasStore";

/** The One Window switch (Settings › General). */
export function CanvasSettingsSection() {
  const enabled = useCanvasStore((state) => state.enabled);
  const setEnabled = useCanvasStore((state) => state.setEnabled);
  return (
    <SettingsSection id="one-window" title="One window">
      <SettingsRow
        title="One window"
        description="Replaces the Control room with one canvas: a rail of your workspaces and the selected workspace, and hides the sidebar. Early preview. Off keeps abode as it was."
        control={
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(Boolean(checked))}
            aria-label="One window"
          />
        }
      />
    </SettingsSection>
  );
}
