-- 032: Product events funnel + enrollment provenance

CREATE TABLE product_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_role TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_events_name_time ON product_events (event_name, created_at);
CREATE INDEX idx_product_events_user ON product_events (user_id);

ALTER TABLE enrollments
    ADD COLUMN enrolled_via TEXT NOT NULL DEFAULT 'unknown'
    CHECK (enrolled_via IN ('unknown', 'teacher_added', 'self_join', 'share_link'));
