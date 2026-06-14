-- dedup log so a session reminder is sent at most once per (session, user, kind)
CREATE TABLE session_reminder_log (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    kind              TEXT NOT NULL CHECK (kind IN ('24h','1h')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, recipient_user_id, kind)
);

-- one-time profile-completion nudge marker
ALTER TABLE users ADD COLUMN profile_nudge_sent_at TIMESTAMPTZ;
