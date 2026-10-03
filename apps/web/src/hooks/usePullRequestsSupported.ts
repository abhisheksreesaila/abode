import { useEnvironments } from "../state/environments";

/** The same check the pull request page uses: one connected server offering them is enough. */
export function usePullRequestsSupported() {
  const { environments } = useEnvironments();
  return environments.some(
    (environment) => environment.serverConfig?.environment.capabilities.pullRequests === true,
  );
}
