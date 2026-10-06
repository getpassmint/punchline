-- Cards exist before their pass does: /scan creates the row and redirects
-- straight away, and the pass is issued in the background. So a card gets
-- its own id, the Passmint pass id moves to pass_id (null until issued), and
-- the pass fields become nullable. SQLite can't relax NOT NULL in place, so
-- the table is rebuilt. Cards issued before this keep their pass id as id.
CREATE TABLE cards_new (
  id TEXT PRIMARY KEY, -- card_… (older cards: their pass id)
  pass_id TEXT, -- Passmint pass id (pass_...), null until issued
  issue_state TEXT NOT NULL DEFAULT 'ready' CHECK (issue_state IN ('issuing', 'ready', 'failed')),
  issue_error TEXT, -- why issuing failed, shown with a retry button
  short_id TEXT,
  serial_number TEXT,
  url TEXT,
  download_url TEXT,
  google_wallet_url TEXT,
  stamp_count INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'reward')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  session_id TEXT,
  wallet_platform TEXT,
  added_at TEXT,
  pushed_at TEXT,
  delivered_at TEXT
);

INSERT INTO cards_new (
  id, pass_id, issue_state, short_id, serial_number, url, download_url, google_wallet_url,
  stamp_count, state, created_at, updated_at, session_id, wallet_platform, added_at, pushed_at,
  delivered_at
)
SELECT
  id, id, 'ready', short_id, serial_number, url, download_url, google_wallet_url,
  stamp_count, state, created_at, updated_at, session_id, wallet_platform, added_at, pushed_at,
  delivered_at
FROM cards;

DROP TABLE cards;
ALTER TABLE cards_new RENAME TO cards;

CREATE INDEX cards_updated_at ON cards (updated_at DESC);
CREATE INDEX cards_session ON cards (session_id, created_at DESC);
CREATE INDEX cards_short_id ON cards (short_id);
CREATE UNIQUE INDEX cards_pass_id ON cards (pass_id);
