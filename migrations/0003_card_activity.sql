-- What happened to a card, newest last: the app's own transitions plus the
-- wallet events Passmint reports by webhook. Drives the activity feed beside
-- the pass replica, so a visitor sees each API call and its result.
CREATE TABLE card_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL,
  -- issued | punched | reward | redeemed | added | delivered | removed
  kind TEXT NOT NULL,
  -- punches after the transition (app events only)
  stamp_count INTEGER,
  -- who acted: 'counter' | 'visitor', or the wallet platform for webhooks
  actor TEXT,
  at TEXT NOT NULL
);

CREATE INDEX card_activity_card ON card_activity (card_id, id DESC);
