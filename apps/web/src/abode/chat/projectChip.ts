const HOME_PREFIX = /^(?:\/home\/[^/]+|\/Users\/[^/]+|\/root|[A-Za-z]:\/Users\/[^/]+)(?=\/|$)/i;
/** `\\wsl.localhost\Ubuntu\…` and `\\wsl$\Ubuntu\…`: a WSL distro seen from Windows. */
const WSL_PREFIX = /^\/\/wsl(?:\.localhost|\$)\/[^/]+(?=\/|$)/i;

/**
 * The grey hint beside a project in the picker: its parent folder, home-relative
 * (`/home/me/Projects/travelos` -> `~/Projects`), the way VS Code's folder picker shows it.
 * Empty when there is nothing above it worth showing (the home folder itself).
 */
export function projectParentLabel(workspaceRoot: string): string {
  const path = workspaceRoot.replace(/\\/g, "/").replace(/\/+$/, "").replace(WSL_PREFIX, "");
  if (path === "") return "";
  const home = HOME_PREFIX.exec(path);
  if (home && home[0].length === path.length) return "";
  const display = home ? `~${path.slice(home[0].length)}` : path;
  const cut = display.lastIndexOf("/");
  if (cut < 0) return display;
  return cut === 0 ? "/" : display.slice(0, cut);
}
