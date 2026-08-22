DROP TABLE IF EXISTS qf_oauth_states;
DROP TABLE IF EXISTS qf_accounts;
ALTER TABLE users DROP COLUMN IF EXISTS role_selection_pending;
ALTER TABLE recitations DROP COLUMN IF EXISTS qf_synced_at;
ALTER TABLE recitations DROP COLUMN IF EXISTS qf_sync_error;
