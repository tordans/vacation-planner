-- Initial schema. Keep it portable: MariaDB 10.11 in production, SQLite in tests.
-- One statement per semicolon; no semicolons inside string literals (the runner splits on them).

-- The shared plan. Always row id 1 (one plan for the family). `data` is the plan in the wire
-- format of the URL (JSON text), returned unchanged. `version` counts saves and is the ETag.
-- `updated_at` is UTC with milliseconds.
CREATE TABLE IF NOT EXISTS plan (
  id         TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  data       LONGTEXT NOT NULL,
  version    INT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL
);
