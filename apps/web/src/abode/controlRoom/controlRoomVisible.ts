/** The Control room shows once the shells are loaded and there is at least one project. */
export function controlRoomVisible(input: {
  readonly bootstrapped: boolean;
  readonly projectCount: number;
}): boolean {
  return input.bootstrapped && input.projectCount > 0;
}
