-- 031: Freehand whiteboard strokes for live sessions (mushaf per-page + board surface)

CREATE TABLE session_strokes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    -- NULL = board surface; non-null = mushaf page number (1–604)
    page INT NULL,
    points JSONB NOT NULL,
    color TEXT NOT NULL,
    width REAL NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT session_strokes_page_range CHECK (page IS NULL OR (page >= 1 AND page <= 604))
);

CREATE INDEX idx_session_strokes_session_page ON session_strokes (session_id, page);
