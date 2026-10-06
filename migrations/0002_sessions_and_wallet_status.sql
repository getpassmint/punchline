-- A session is one visitor across their devices: the laptop showing the QR
-- and the phone that scans it share the id (it rides in the QR), so both
-- screens resolve to the same card. Null on cards issued before sessions.
ALTER TABLE cards ADD COLUMN session_id TEXT;

-- Wallet status, fed by Passmint webhooks (all null until one is registered).
-- added_at is cleared again on pass.removed.
ALTER TABLE cards ADD COLUMN wallet_platform TEXT; -- 'apple' | 'google'
ALTER TABLE cards ADD COLUMN added_at TEXT;
-- Set by the app on every push; compared with delivered_at to show whether
-- the phone has picked up the latest state yet.
ALTER TABLE cards ADD COLUMN pushed_at TEXT;
ALTER TABLE cards ADD COLUMN delivered_at TEXT;

CREATE INDEX cards_session ON cards (session_id, created_at DESC);
