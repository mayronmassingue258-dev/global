CREATE TABLE "discovery_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"dry_run" boolean NOT NULL,
	"provider" text NOT NULL,
	"sources" text[] NOT NULL,
	"started_by" uuid,
	"summary" jsonb,
	"log" text DEFAULT '' NOT NULL,
	CONSTRAINT "discovery_runs_status_chk" CHECK ("discovery_runs"."status" in ('running','done','failed'))
);
--> statement-breakpoint
ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discovery_runs_started_idx" ON "discovery_runs" USING btree ("started_at");--> statement-breakpoint
ALTER TABLE "discovery_runs" ENABLE ROW LEVEL SECURITY;
