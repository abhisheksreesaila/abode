import { parsePlan, type Milestone, type Plan } from "./plan/parsePlan";

export type PlanBlock =
  | { readonly kind: "loading" }
  | { readonly kind: "missing" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ready"; readonly goal: string | undefined; readonly rows: Milestone[] };

export interface PlanFileState {
  readonly error: string | null;
  /** null while unread; `exists: false` is a plan.md that is not there. */
  readonly file: { readonly exists: boolean; readonly contents: string } | null;
}

/** Which of the plan block's four states to show, and the milestone rows when there is a plan. */
export function planBlock(state: PlanFileState): PlanBlock {
  if (state.file?.exists === false) return { kind: "missing" };
  if (state.file !== null) {
    const plan: Plan = parsePlan(state.file.contents);
    return plan.milestones.length === 0
      ? { kind: "missing" }
      : { kind: "ready", goal: plan.goal, rows: plan.milestones };
  }
  if (state.error !== null) return { kind: "error", message: state.error };
  return { kind: "loading" };
}

/** The milestone in progress, for the phone list row; undefined while loading or without a plan. */
export function currentMilestoneName(block: PlanBlock): string | undefined {
  return block.kind === "ready"
    ? block.rows.find((row) => row.state === "current")?.name
    : undefined;
}
