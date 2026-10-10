ALTER TABLE rooms ADD COLUMN IF NOT EXISTS website_listed BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_rooms_website_listing
  ON rooms(created_at DESC)
  WHERE is_public = true AND is_active = true AND website_listed = true;
