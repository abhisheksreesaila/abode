import { useTheme } from "../../hooks/useTheme";

export const FLUENT_THEME_ID = "abode";

/** The theme id actually painted: the automatic-mode half for the resolved appearance wins. */
export function isFluentTheme(snapshot: {
  theme: string;
  resolvedTheme: "light" | "dark";
  themeHalves?: Partial<Record<"light" | "dark", string>> | null;
}): boolean {
  return (snapshot.themeHalves?.[snapshot.resolvedTheme] ?? snapshot.theme) === FLUENT_THEME_ID;
}

/** One reactive answer to "is the Fluent look on", shared by the transcript and the composer. */
export function useIsFluentTheme(): boolean {
  const { theme, resolvedTheme, themeHalves } = useTheme();
  return isFluentTheme({ theme, resolvedTheme, themeHalves });
}
