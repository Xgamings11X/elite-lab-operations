CREATE TABLE IF NOT EXISTS users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  name text, avatar_url text, google_sub text UNIQUE,
  role text NOT NULL CHECK (role IN ('admin','viewer')),
  is_active boolean NOT NULL DEFAULT true,
  invited_by integer REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS oauth_attempts (
  state_hash text PRIMARY KEY, verifier text NOT NULL, nonce text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_expiry ON oauth_attempts(expires_at);
CREATE TABLE IF NOT EXISTS devices (
  id text PRIMARY KEY, last_seen timestamptz
);
CREATE TABLE IF NOT EXISTS members (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name text NOT NULL, class_name text NOT NULL,
  division text NOT NULL,
  fingerprint_id integer CHECK (fingerprint_id BETWEEN 1 AND 65535),
  fingerprint_device text REFERENCES devices(id),
  is_active boolean NOT NULL DEFAULT true,
  CHECK ((fingerprint_id IS NULL) = (fingerprint_device IS NULL)),
  UNIQUE(fingerprint_device, fingerprint_id)
);
CREATE TABLE IF NOT EXISTS attendances (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_id integer NOT NULL REFERENCES members(id),
  date date NOT NULL, check_in_time time, check_out_time time,
  method text NOT NULL CHECK (method IN ('esp32_c1_fingerprint','manual')),
  status text NOT NULL CONSTRAINT attendance_status_with_absence CHECK (status IN ('present','absent','excused','competition')),
  notes text NOT NULL DEFAULT '', last_scan_at timestamptz,
  UNIQUE(member_id,date),
  CHECK (check_out_time IS NULL OR (check_in_time IS NOT NULL AND check_out_time >= check_in_time)),
  CHECK (status = 'present' OR (check_in_time IS NULL AND check_out_time IS NULL))
);
CREATE INDEX IF NOT EXISTS attendance_date ON attendances(date);
CREATE TABLE IF NOT EXISTS scan_events (
  device_id text NOT NULL REFERENCES devices(id),
  event_id uuid NOT NULL, fingerprint_id integer NOT NULL,
  response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(device_id,event_id)
);
CREATE TABLE IF NOT EXISTS picket_schedules (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  member_id integer NOT NULL REFERENCES members(id),
  UNIQUE(day_of_week,member_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('piket','dokumentasi')),
  date date NOT NULL,
  division text,
  caption text NOT NULL,
  photo_key text NOT NULL UNIQUE,
  demo_asset boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','approved','rejected')),
  verified_by_email text, verified_at timestamptz,
  verification_note text NOT NULL DEFAULT '',
  submitted_by_email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'dokumentasi' OR division IS NOT NULL),
  CHECK (verification_status <> 'rejected' OR length(trim(verification_note)) > 0)
);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS photo_data bytea;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS picket_snapshot jsonb;
CREATE TABLE IF NOT EXISTS admin_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id integer NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('attendance_saved','report_approved','report_revision','fingerprint_linked','fingerprint_unlinked','access_granted','access_revoked')),
  entity_id integer NOT NULL,
  detail text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_status_date ON reports(verification_status, date DESC, id DESC);
CREATE INDEX IF NOT EXISTS reports_kind_date ON reports(kind, date DESC, id DESC);
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_division_check;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_division_check;
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='attendances'::regclass AND conname='attendance_status_with_absence') THEN
    ALTER TABLE attendances DROP CONSTRAINT IF EXISTS attendances_status_check;
    ALTER TABLE attendances ADD CONSTRAINT attendance_status_with_absence CHECK(status IN ('present','absent','excused','competition'));
  END IF;
END $migration$;
CREATE INDEX IF NOT EXISTS reports_created_at ON reports(created_at DESC);
