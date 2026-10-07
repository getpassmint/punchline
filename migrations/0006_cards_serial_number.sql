-- The counter looks cards up by the code printed under the pass barcode,
-- which is the pass's serial number.
CREATE INDEX cards_serial_number ON cards (serial_number);
