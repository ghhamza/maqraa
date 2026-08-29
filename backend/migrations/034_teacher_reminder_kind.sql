-- Expand session_reminder_log.kind for teacher pre-session nudge (distinct from 24h/1h).
ALTER TABLE session_reminder_log DROP CONSTRAINT IF EXISTS session_reminder_log_kind_check;
ALTER TABLE session_reminder_log
  ADD CONSTRAINT session_reminder_log_kind_check
  CHECK (kind IN ('24h', '1h', 'teacher_nudge_2h'));
