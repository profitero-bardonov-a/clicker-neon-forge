CREATE TABLE IF NOT EXISTS scores (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'Player',
  avatar_url TEXT,
  clicks BIGINT NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scores_clicks_desc_idx
  ON scores (clicks DESC, updated_at ASC);
