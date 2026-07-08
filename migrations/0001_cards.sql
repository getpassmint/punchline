-- One row per stamp card = one wallet pass. The card's primary key is the
-- Passmint pass id (pass_...), so the app never needs a mapping table:
-- whatever D1 says about a card, the same id addresses the pass in Passmint.
CREATE TABLE cards (
  id TEXT PRIMARY KEY, -- Passmint pass id (pass_...)
  short_id TEXT NOT NULL, -- human-friendly id, shown at the counter
  serial_number TEXT NOT NULL, -- wallet serial; also the QR payload on the pass
  url TEXT NOT NULL, -- Passmint's hosted add-to-wallet page for this pass
  -- Direct platform links from Passmint. Null when a platform wasn't
  -- delivered; the add-to-wallet buttons fall back to `url`.
  download_url TEXT, -- Apple .pkpass
  google_wallet_url TEXT, -- Google "save to wallet" link
  stamp_count INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'reward')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX cards_updated_at ON cards (updated_at DESC);
