-- Expand session_reminder_log.kind for end-of-session student summary emails.
ALTER TABLE session_reminder_log DROP CONSTRAINT IF EXISTS session_reminder_log_kind_check;
ALTER TABLE session_reminder_log
  ADD CONSTRAINT session_reminder_log_kind_check
  CHECK (kind IN ('24h', '1h', 'teacher_nudge_2h', 'session_summary'));
