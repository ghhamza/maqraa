CREATE TABLE digest_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    digest_key    TEXT NOT NULL,
    sent_for_date DATE NOT NULL,
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (digest_key, sent_for_date)
);
