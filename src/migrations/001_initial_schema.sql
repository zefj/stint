-- Timers: Named trackable activities
CREATE TABLE IF NOT EXISTS timers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#f5f5f4',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Timer Sessions: Historical records of timer activity
CREATE TABLE IF NOT EXISTS timer_sessions (
  id TEXT PRIMARY KEY,
  timer_id TEXT NOT NULL,
  start INTEGER NOT NULL,
  end INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (timer_id) REFERENCES timers(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_timer ON timer_sessions(timer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_end ON timer_sessions(end);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON timer_sessions(start);

-- Note: Only one active session per timer is enforced in application logic
-- (SQLite doesn't support partial indexes or CHECK constraints with subqueries easily)
