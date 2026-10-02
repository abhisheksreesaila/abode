import type { ThemeColors, ThemeDefinition } from "./themePalettes.ts";

export const ABODE_THEME_ID = "abode";

/**
 * VS Code Dark Modern with the Fluent accent, per docs/design/fluent.md. Dark only: the theme
 * has no light half, so selecting it pins the appearance to dark.
 *
 * Deliberately not part of BUILT_IN_THEMES / BUILT_IN_THEME_IDS: those lists
 * are mirrored by the mobile app's Uniwind themes, and abode is a web and
 * desktop look.
 */
export const ABODE_DARK_THEME_COLORS: ThemeColors = {
  canvas: "#1f1f1f",
  chrome: "#181818",
  toolbar: "#181818",
  toolbarForeground: "#cccccc",
  toolbarBorder: "#2b2b2b",
  toolbarControl: "#252526",
  toolbarControlForeground: "#cccccc",
  toolbarControlHover: "#2a2d2e",
  surface: "#1f1f1f",
  surfaceRaised: "#252526",
  surfaceOverlay: "#252526",
  text: "#cccccc",
  textMuted: "#9d9d9d",
  border: "#2b2b2b",
  input: "#313131",
  focus: "#0078d4",
  accent: "#0078d4",
  accentForeground: "#ffffff",
  secondary: "#313131",
  secondaryForeground: "#cccccc",
  muted: "#252526",
  mutedForeground: "#9d9d9d",
  placeholder: "#9d9d9d",
  secondaryLabel: "#9d9d9d",
  iconMuted: "#9d9d9d",
  error: "#f14c4c",
  errorForeground: "#f14c4c",
  errorSurface: "#2b1618",
  warning: "#cca700",
  warningForeground: "#cca700",
  warningSurface: "#2e2a12",
  update: "#0078d4",
  updateForeground: "#4cc2ff",
  updateSurface: "#14283c",
  accentSurface: "#2a2d2e",
  accentSurfaceForeground: "#e7e7e7",
  messageSurface: "#2a2d2e",
  messageForeground: "#e7e7e7",
  messageAction: "#0078d4",
  messageActionForeground: "#ffffff",
  messageActionHover: "#026ec1",
  codeBackground: "#181818",
  codeForeground: "#cccccc",
  sidebar: "#181818",
  sidebarForeground: "#cccccc",
  sidebarMutedForeground: "#9d9d9d",
  sidebarControlSurface: "#252526",
  sidebarRowHover: "#2a2d2e",
  sidebarRowActive: "#04395e",
  sidebarRowSelected: "#04395e",
  sidebarBorder: "#2b2b2b",
  terminalBackground: "#181818",
  terminalForeground: "#cccccc",
  terminalCursor: "#aeafad",
  terminalSelection: "#264f78",
  terminalScrollbar: "#424242",
  terminalScrollbarHover: "#4f4f4f",
};

export const ABODE_THEME: ThemeDefinition = {
  id: ABODE_THEME_ID,
  label: "abode",
  appearance: "dark",
  colors: ABODE_DARK_THEME_COLORS,
};

/** Workspace accents, assigned in order (F-006). Mirrors --ws-1..8 in index.css. */
export const ABODE_WORKSPACE_COLORS = [
  "#4cc2ff",
  "#c586c0",
  "#dcdcaa",
  "#4ec9b0",
  "#f48771",
  "#b5cea8",
  "#9cdcfe",
  "#d7ba7d",
] as const;
