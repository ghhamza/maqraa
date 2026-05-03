-- 019: Extend plan_status to paused and skipped (explicit lifecycle; no backfill needed).

ALTER TABLE recitations DROP CONSTRAINT IF EXISTS recitations_plan_status_check;
ALTER TABLE recitations ADD CONSTRAINT recitations_plan_status_check
  CHECK (
    plan_status IS NULL
    OR plan_status IN ('planned', 'in_progress', 'paused', 'completed', 'skipped')
  );
