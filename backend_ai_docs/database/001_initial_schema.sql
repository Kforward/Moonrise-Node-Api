-- Moonrise backend initial PostgreSQL schema draft.
-- This file is a design artifact. Review and adapt before production migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_status AS ENUM ('active', 'disabled', 'deleted');
CREATE TYPE auth_provider AS ENUM ('wechat_miniprogram', 'local_dev');
CREATE TYPE privacy_storage_mode AS ENUM ('plain', 'encrypted', 'e2ee');
CREATE TYPE privacy_cipher_algorithm AS ENUM ('none', 'aes', 'xchacha20_poly1305');
CREATE TYPE sync_entity_type AS ENUM ('user_profile', 'cycle_settings', 'period_record', 'backup_snapshot', 'privacy_config', 'vault_item');
CREATE TYPE sync_operation AS ENUM ('create', 'update', 'delete', 'restore');

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  provider auth_provider NOT NULL,
  provider_subject varchar(128) NOT NULL,
  union_subject varchar(128),
  credential_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  device_key_hash text NOT NULL,
  platform varchar(32) NOT NULL,
  device_name varchar(120),
  public_key text,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_key_hash)
);

CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES app_users(id),
  nickname varchar(80),
  avatar_url text,
  gender smallint NOT NULL DEFAULT 0,
  phone_ciphertext text,
  phone_hash text,
  email_ciphertext text,
  email_hash text,
  profile_ciphertext text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cycle_settings (
  user_id uuid PRIMARY KEY REFERENCES app_users(id),
  avg_cycle_length smallint NOT NULL DEFAULT 28 CHECK (avg_cycle_length BETWEEN 15 AND 100),
  avg_period_length smallint NOT NULL DEFAULT 5 CHECK (avg_period_length BETWEEN 2 AND 14),
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_days_ahead smallint NOT NULL DEFAULT 3 CHECK (reminder_days_ahead BETWEEN 0 AND 14),
  reminder_time time NOT NULL DEFAULT '09:00',
  client_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE period_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  client_record_id varchar(80) NOT NULL,
  start_date date NOT NULL,
  end_date date,
  intensity smallint NOT NULL CHECK (intensity IN (1, 2, 3)),
  pain_level smallint NOT NULL CHECK (pain_level IN (0, 1, 2, 3)),
  moods jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes_ciphertext text,
  notes_preview_hash text,
  version bigint NOT NULL DEFAULT 1,
  client_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (end_date IS NULL OR end_date >= start_date),
  UNIQUE (user_id, client_record_id)
);

CREATE INDEX idx_period_records_user_start_date ON period_records(user_id, start_date);
CREATE INDEX idx_period_records_user_updated ON period_records(user_id, updated_at);

CREATE TABLE user_app_preferences (
  user_id uuid PRIMARY KEY REFERENCES app_users(id),
  history_entry_hint_dismissed boolean NOT NULL DEFAULT false,
  empty_guide_skipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE privacy_configs (
  user_id uuid PRIMARY KEY REFERENCES app_users(id),
  storage_mode privacy_storage_mode NOT NULL DEFAULT 'encrypted',
  cipher_algorithm privacy_cipher_algorithm NOT NULL DEFAULT 'aes',
  key_version integer NOT NULL DEFAULT 1,
  e2ee_enabled boolean NOT NULL DEFAULT false,
  recovery_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE encrypted_vault_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  entity_type sync_entity_type NOT NULL,
  entity_id varchar(120) NOT NULL,
  algorithm privacy_cipher_algorithm NOT NULL,
  key_version integer NOT NULL,
  nonce text,
  aad text,
  ciphertext text NOT NULL,
  content_hash text,
  client_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, entity_type, entity_id)
);

CREATE TABLE backup_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  client_backup_id varchar(80) NOT NULL,
  encrypted boolean NOT NULL DEFAULT true,
  algorithm privacy_cipher_algorithm NOT NULL DEFAULT 'aes',
  key_version integer NOT NULL DEFAULT 1,
  size_bytes integer NOT NULL DEFAULT 0,
  snapshot_ciphertext text NOT NULL,
  snapshot_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, client_backup_id)
);

CREATE INDEX idx_backup_snapshots_user_created ON backup_snapshots(user_id, created_at DESC);

CREATE TABLE sync_change_logs (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id),
  entity_type sync_entity_type NOT NULL,
  entity_id varchar(120) NOT NULL,
  operation sync_operation NOT NULL,
  entity_version bigint,
  client_mutation_id varchar(120),
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_mutation_id)
);

CREATE INDEX idx_sync_change_logs_user_id ON sync_change_logs(user_id, id);

CREATE TABLE idempotency_records (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  client_mutation_id varchar(120) NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_mutation_id)
);

CREATE INDEX idx_idempotency_records_user_created ON idempotency_records(user_id, created_at);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES app_users(id),
  device_id uuid REFERENCES user_devices(id),
  action varchar(80) NOT NULL,
  resource_type varchar(80),
  resource_id varchar(120),
  success boolean NOT NULL DEFAULT true,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);

CREATE TABLE app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version varchar(40) NOT NULL UNIQUE,
  released_at date NOT NULL,
  title varchar(120) NOT NULL,
  summary text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_release_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES app_releases(id),
  entry_type varchar(40) NOT NULL,
  content text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_release_entries_release_sort ON app_release_entries(release_id, sort_order);
