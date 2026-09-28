-- Additive, disabled-by-default authentication migration. Apply only after backup.
CREATE TABLE IF NOT EXISTS workos_identities (
  client_id text NOT NULL,
  subject text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workos_identity_subject UNIQUE(client_id, subject),
  CONSTRAINT workos_identity_user UNIQUE(client_id, user_id)
);
CREATE TABLE IF NOT EXISTS workos_attempts (
  state_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  encrypted_data text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS workos_attempt_expiry ON workos_attempts(expires_at);
CREATE TABLE IF NOT EXISTS workos_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  client_id text NOT NULL,
  actor text NOT NULL CHECK(actor IN ('store', 'vendor')),
  secret_hash text NOT NULL,
  encrypted_refresh text NOT NULL,
  password_version text NOT NULL,
  expires_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL,
  lock_id text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workos_session_user ON workos_sessions(user_id);
CREATE INDEX IF NOT EXISTS workos_session_expiry ON workos_sessions(expires_at);
-- Auth data is only accessed through the trusted Worker database connection.
ALTER TABLE workos_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE workos_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workos_sessions ENABLE ROW LEVEL SECURITY;
