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
        description="abode's own layout: a rail of your workspaces, the Jam, Milestones and Design tabs, Calm and avatars. Off is T3 Code's own interface; the Kit stays in the command palette."
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
