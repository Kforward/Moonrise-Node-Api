CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('wechat_miniprogram', 'local_dev');--> statement-breakpoint
CREATE TYPE "public"."privacy_cipher_algorithm" AS ENUM('none', 'aes-256-gcm', 'xchacha20-poly1305');--> statement-breakpoint
CREATE TYPE "public"."privacy_storage_mode" AS ENUM('plain', 'encrypted', 'e2ee');--> statement-breakpoint
CREATE TYPE "public"."sync_entity_type" AS ENUM('user_profile', 'cycle_settings', 'period_record', 'backup_snapshot', 'privacy_config', 'vault_item');--> statement-breakpoint
CREATE TYPE "public"."sync_operation" AS ENUM('create', 'update', 'delete', 'restore');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled', 'deleted');--> statement-breakpoint
CREATE TABLE "app_release_entries" (
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entry_type" varchar(40) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_releases" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"released_at" date NOT NULL,
	"summary" text NOT NULL,
	"title" varchar(120) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" varchar(40) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_users" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"action" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_id" uuid,
	"id" bigserial PRIMARY KEY NOT NULL,
	"ip_hash" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resource_id" varchar(120),
	"resource_type" varchar(80),
	"success" boolean DEFAULT true NOT NULL,
	"user_agent_hash" text,
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"credential_hash" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_subject" varchar(128) NOT NULL,
	"union_subject" varchar(128),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_snapshots" (
	"algorithm" "privacy_cipher_algorithm" DEFAULT 'none' NOT NULL,
	"client_backup_id" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"encrypted" boolean DEFAULT false NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"size_bytes" integer NOT NULL,
	"snapshot_ciphertext" text NOT NULL,
	"snapshot_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle_settings" (
	"avg_cycle_length" smallint DEFAULT 28 NOT NULL,
	"avg_period_length" smallint DEFAULT 5 NOT NULL,
	"client_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reminder_days_ahead" smallint DEFAULT 3 NOT NULL,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"reminder_time" time DEFAULT '09:00'::time NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encrypted_vault_items" (
	"aad" text,
	"algorithm" "privacy_cipher_algorithm" NOT NULL,
	"ciphertext" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"entity_id" varchar(120) NOT NULL,
	"entity_type" "sync_entity_type" NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_version" integer NOT NULL,
	"nonce" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_records" (
	"client_record_id" varchar(80) NOT NULL,
	"client_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"end_date" date,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intensity" smallint NOT NULL,
	"moods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes_ciphertext" text,
	"pain_level" smallint NOT NULL,
	"start_date" date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_configs" (
	"cipher_algorithm" "privacy_cipher_algorithm" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"e2ee_enabled" boolean DEFAULT false NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"recovery_enabled" boolean DEFAULT false NOT NULL,
	"storage_mode" "privacy_storage_mode" DEFAULT 'plain' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_change_logs" (
	"checksum" text,
	"client_mutation_id" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entity_id" varchar(120) NOT NULL,
	"entity_type" "sync_entity_type" NOT NULL,
	"entity_version" bigint,
	"id" bigserial PRIMARY KEY NOT NULL,
	"operation" "sync_operation" NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_app_preferences" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"empty_guide_skipped" boolean DEFAULT false NOT NULL,
	"history_entry_hint_dismissed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_key_hash" text NOT NULL,
	"device_name" varchar(120),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"platform" varchar(32) NOT NULL,
	"public_key" text,
	"refresh_token_hash" text,
	"revoked_at" timestamp with time zone,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email_ciphertext" text,
	"email_hash" text,
	"gender" smallint DEFAULT 0 NOT NULL,
	"nickname" varchar(80),
	"phone_ciphertext" text,
	"phone_hash" text,
	"profile_ciphertext" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_release_entries" ADD CONSTRAINT "app_release_entries_release_id_app_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."app_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_snapshots" ADD CONSTRAINT "backup_snapshots_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_settings" ADD CONSTRAINT "cycle_settings_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encrypted_vault_items" ADD CONSTRAINT "encrypted_vault_items_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_records" ADD CONSTRAINT "period_records_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_configs" ADD CONSTRAINT "privacy_configs_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_change_logs" ADD CONSTRAINT "sync_change_logs_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_app_preferences" ADD CONSTRAINT "user_app_preferences_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_release_entries_release_sort_idx" ON "app_release_entries" USING btree ("release_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "app_releases_version_uidx" ON "app_releases" USING btree ("version");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_created_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_subject_uidx" ON "auth_identities" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE INDEX "backup_snapshots_user_created_idx" ON "backup_snapshots" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "backup_snapshots_user_client_uidx" ON "backup_snapshots" USING btree ("user_id","client_backup_id");--> statement-breakpoint
CREATE INDEX "encrypted_vault_items_user_idx" ON "encrypted_vault_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "encrypted_vault_items_entity_uidx" ON "encrypted_vault_items" USING btree ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "period_records_user_start_idx" ON "period_records" USING btree ("user_id","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "period_records_user_client_uidx" ON "period_records" USING btree ("user_id","client_record_id");--> statement-breakpoint
CREATE INDEX "sync_change_logs_user_id_idx" ON "sync_change_logs" USING btree ("user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_change_logs_user_mutation_uidx" ON "sync_change_logs" USING btree ("user_id","client_mutation_id");--> statement-breakpoint
CREATE INDEX "user_devices_user_id_idx" ON "user_devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_devices_user_key_uidx" ON "user_devices" USING btree ("user_id","device_key_hash");
