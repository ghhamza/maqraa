-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Room setup gate + onboarding email send log.

ALTER TABLE rooms ADD COLUMN setup_completed_at TIMESTAMPTZ;

-- Existing rooms are considered set up.
UPDATE rooms SET setup_completed_at = created_at;

CREATE TABLE onboarding_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,          -- 'setup_incomplete' | 'share_nudge'
  seq         SMALLINT NOT NULL,      -- 1 = first reminder, 2 = second
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, kind, seq)
);

CREATE INDEX idx_onboarding_emails_room ON onboarding_emails(room_id);

-- Optional PNG attachment for share-nudge emails (and future use).
ALTER TABLE notifications
  ADD COLUMN attachment_filename TEXT,
  ADD COLUMN attachment_content BYTEA;
