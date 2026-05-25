CREATE TABLE "idempotency_records" (
	"client_mutation_id" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"response" jsonb NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idempotency_records_user_created_idx" ON "idempotency_records" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_records_user_mutation_uidx" ON "idempotency_records" USING btree ("user_id","client_mutation_id");