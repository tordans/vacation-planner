-- Secret calendar link (iCal) of a plan: at most one per plan, made on request by the edit role.
-- As with the plan keys, only the SHA-256 hex digest of the link's key is stored.
CREATE TABLE IF NOT EXISTS calendar_feeds (
  plan_id    CHAR(32) NOT NULL PRIMARY KEY,
  key_sha256 CHAR(64) NOT NULL UNIQUE
);
