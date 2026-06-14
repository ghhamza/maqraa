-- Profiling fields + a gate flag so existing and new users are forced
-- through a profile-completion step before using the app.

ALTER TABLE users
    ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female')),
    ADD COLUMN date_of_birth DATE,
    ADD COLUMN country TEXT,
    ADD COLUMN phone TEXT,
    ADD COLUMN spoken_languages TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN qiraat_taught TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN profile_completion_pending BOOLEAN NOT NULL DEFAULT true;
