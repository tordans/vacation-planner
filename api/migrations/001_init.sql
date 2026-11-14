-- Initial schema. Keep it portable: MariaDB 10.11 in production, SQLite in tests.
-- One statement per semicolon; no semicolons inside string literals (the runner splits on them).

-- One row per plan. `id` is random hex made by the API (internal only, never in a URL), so no
-- AUTO_INCREMENT is needed and the same SQL runs on MariaDB and SQLite. The two keys are never
-- stored, only their SHA-256 hex digests; a link finds its plan by the digest of its key (the
-- UNIQUE constraints are the indexes for that). `data` is the plan in the wire format of the URL
-- (JSON text, returned unchanged) and NULL until the first save; `version` counts saves (0 until
-- then) and is the ETag. `updated_at` and `created_at` are UTC with milliseconds.
CREATE TABLE IF NOT EXISTS plans (
  id              CHAR(32) NOT NULL PRIMARY KEY,
  edit_key_sha256 CHAR(64) NOT NULL UNIQUE,
  view_key_sha256 CHAR(64) NOT NULL UNIQUE,
  data            LONGTEXT NULL,
  version         INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at      DATETIME(3) NULL,
  created_at      DATETIME(3) NOT NULL
);

-- Failed invite attempts, one row each, kept for one hour. `ip_hash` is an HMAC of the IP address
-- with a salt that changes every day, so no plain IP address is ever stored.
CREATE TABLE IF NOT EXISTS invite_attempts (
  ip_hash      CHAR(64) NOT NULL,
  attempted_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invite_attempts_ip ON invite_attempts (ip_hash);
