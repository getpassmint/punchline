-- The counter looks cards up by the code printed under the pass barcode,
-- the way a till would scan it.
CREATE INDEX cards_short_id ON cards (short_id);
