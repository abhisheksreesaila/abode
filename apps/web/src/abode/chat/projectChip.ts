const HOME_PREFIX = /^(?:\/home\/[^/]+|\/Users\/[^/]+|\/root|[A-Za-z]:\/Users\/[^/]+)(?=\/|$)/;

/**
 * The grey hint beside a project in the picker: its parent folder, home-relative
 * (`/home/me/Projects/travelos` -> `~/Projects`), the way VS Code's folder picker shows it.
 */
export function projectParentLabel(workspaceRoot: string): string {
  const path = workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  if (path === "") return "";
  const home = HOME_PREFIX.exec(path);
  const display = home ? `~${path.slice(home[0].length)}` : path;
  const cut = display.lastIndexOf("/");
  if (cut < 0) return display;
  return cut === 0 ? "/" : display.slice(0, cut);
}
