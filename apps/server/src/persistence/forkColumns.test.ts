import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

import { ensureForkColumns } from "./forkColumns.ts";
import { runMigrations } from "./Migrations.ts";

it.layer(NodeSqliteClient.layer({ filename: ":memory:" }))("ensureForkColumns", (it) => {
  it.effect("adds autonomous_json once and keeps data when re-run", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations();
      yield* ensureForkColumns;
      const now = "2026-01-01T00:00:00.000Z";
      yield* sql`
        INSERT INTO projection_threads (
          thread_id, project_id, title, model_selection_json, runtime_mode,
          created_at, updated_at, autonomous_json
        ) VALUES (
          'thread-1', 'project-1', 'T', '{"instanceId":"codex","model":"gpt-5.4"}',
          'full-access', ${now}, ${now}, '{"enabled":true,"count":1,"cap":30}'
        )
      `;
      yield* ensureForkColumns;
      yield* runMigrations();
      yield* ensureForkColumns;
      const rows = yield* sql<{ readonly autonomous: string | null }>`
        SELECT autonomous_json AS autonomous FROM projection_threads WHERE thread_id = 'thread-1'
      `;
      assert.deepEqual(rows, [{ autonomous: '{"enabled":true,"count":1,"cap":30}' }]);
    }),
  );
});
