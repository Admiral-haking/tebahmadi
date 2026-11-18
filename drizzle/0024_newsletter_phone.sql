ALTER TABLE subscribers ADD COLUMN phone TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_phone_unique ON subscribers(phone) WHERE phone <> '';
