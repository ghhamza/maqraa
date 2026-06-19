CREATE TABLE share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    target_type TEXT NOT NULL CHECK (target_type IN ('halaqah', 'session', 'invite', 'instance')),
    target_id UUID,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auto_approve BOOLEAN NOT NULL DEFAULT FALSE,
    email_bound TEXT,
    expires_at TIMESTAMPTZ,
    max_uses INTEGER,
    use_count INTEGER NOT NULL DEFAULT 0,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (target_type = 'instance' OR target_id IS NOT NULL)
);

CREATE INDEX idx_share_links_created_by ON share_links (created_by);
CREATE INDEX idx_share_links_target ON share_links (target_type, target_id);
