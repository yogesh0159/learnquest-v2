const test = require("node:test");
const assert = require("node:assert/strict");
const { ensureMysqlGameRunColumns } = require("../db");

const allCompatibilityColumns = [
  "integrity_token_hash",
  "event_sequence",
  "verified_coins",
  "verified_keys",
  "verified_obstacles",
  "last_event_elapsed_ms",
  "last_event_type",
];

function mysqlExecutor(existingColumns) {
  const calls = [];
  return {
    calls,
    async execute(sql, params) {
      calls.push({ sql, params });
      return [existingColumns.map((COLUMN_NAME) => ({ COLUMN_NAME }))];
    },
    async query(sql) {
      calls.push({ sql });
      return [[], []];
    },
  };
}

test("MySQL compatibility migration inspects columns and adds only missing ones", async () => {
  const executor = mysqlExecutor(allCompatibilityColumns.slice(0, -1));

  await ensureMysqlGameRunColumns(executor);

  assert.match(executor.calls[0].sql, /INFORMATION_SCHEMA\.COLUMNS/);
  assert.deepEqual(executor.calls[0].params, ["game_runs"]);
  assert.equal(executor.calls.length, 2);
  assert.match(executor.calls[1].sql, /ADD COLUMN `last_event_type` VARCHAR\(16\) NULL/);
  assert.doesNotMatch(executor.calls[1].sql, /ADD COLUMN IF NOT EXISTS/);
});

test("MySQL compatibility migration is a no-op when every column exists", async () => {
  const executor = mysqlExecutor(allCompatibilityColumns);

  await ensureMysqlGameRunColumns(executor);

  assert.equal(executor.calls.length, 1);
});
