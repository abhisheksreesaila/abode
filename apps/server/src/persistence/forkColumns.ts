import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

/**
 * Columns this fork adds outside the numbered migration sequence, so a future
 * upstream migration with the same number is never silently skipped. Each
 * step is guarded and idempotent; it runs after `runMigrations` on every start.
 */
export const ensureForkColumns = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;
  // F-032: per-thread autonomous mode state (JSON).
  if (!columns.some((column) => column.name === "autonomous_json")) {
    yield* sql`ALTER TABLE projection_threads ADD COLUMN autonomous_json TEXT`;
  }
});
