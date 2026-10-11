import { CustomizationsSection } from "../customizations/CustomizationsSection";

/**
 * Reserved at the bottom of the abode sidebar for Customizations (A-006:
 * Skills, Agents, MCP servers and Instructions, user-wide and per workspace).
 * The marker attribute is
 * what the end-to-end checks and A-006 key on.
 */
export function CustomizationsSlot() {
  return (
    <div data-abode-slot="customizations" className="contents">
      <CustomizationsSection />
    </div>
  );
}
