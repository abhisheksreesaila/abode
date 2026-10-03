import { useLocation } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "./ui/button";
import { isSidebarUtilityPage, useNavigateToMainApp } from "./sidebar/mainAppLocation";

/**
 * "← Back" at the top-left of a utility page header (abode F-048). Renders only on settings,
 * usage and pull requests, and returns to the last session route (home when there is none).
 */
export function UtilityBackButton() {
  const isUtilityPage = useLocation({
    select: (location) => isSidebarUtilityPage(location.pathname),
  });
  const navigateToMainApp = useNavigateToMainApp();
  if (!isUtilityPage) return null;
  return (
    <Button
      size="xs"
      variant="toolbar"
      aria-label="Back to session"
      className="shrink-0 [-webkit-app-region:no-drag]"
      onClick={() => void navigateToMainApp()}
    >
      <ArrowLeftIcon />
      Back
    </Button>
  );
}
