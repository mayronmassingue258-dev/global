CREATE TABLE "application_documents" (
	"user_id" uuid NOT NULL,
	"scholarship_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	CONSTRAINT "application_documents_user_id_scholarship_id_name_pk" PRIMARY KEY("user_id","scholarship_id","name")
);
--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"scholarship_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"status" text,
	"document" text,
	"done" boolean,
	CONSTRAINT "application_events_kind_chk" CHECK ("application_events"."kind" in ('created','status','document','notes'))
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"user_id" uuid NOT NULL,
	"scholarship_id" text NOT NULL,
	"status" text DEFAULT 'Saved' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_user_id_scholarship_id_pk" PRIMARY KEY("user_id","scholarship_id"),
	CONSTRAINT "applications_status_chk" CHECK ("applications"."status" in ('Saved','Preparing','Ready to submit','Submitted','Decision received'))
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"program" text DEFAULT '' NOT NULL,
	"sections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drafts_type_chk" CHECK ("drafts"."type" in ('motivation_letter','academic_cv','personal_statement','document_review'))
);
--> statement-breakpoint
CREATE TABLE "eligibility_criteria" (
	"scholarship_id" text PRIMARY KEY NOT NULL,
	"accepted_levels" text[] DEFAULT '{}'::text[] NOT NULL,
	"needs" text[] DEFAULT '{}'::text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"residence" text DEFAULT '' NOT NULL,
	"nationality" text DEFAULT '' NOT NULL,
	"level" text DEFAULT '' NOT NULL,
	"field" text DEFAULT '' NOT NULL,
	"grade" text DEFAULT '' NOT NULL,
	"languages" text DEFAULT '' NOT NULL,
	"interests" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scholarships" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"institution" text NOT NULL,
	"country" text NOT NULL,
	"level" text NOT NULL,
	"funding_type" text NOT NULL,
	"funding" text NOT NULL,
	"deadline" date NOT NULL,
	"deadline_timezone" text,
	"summary" text NOT NULL,
	"requirements" text[] DEFAULT '{}'::text[] NOT NULL,
	"required_documents" text[] DEFAULT '{}'::text[] NOT NULL,
	"application_process" text,
	"eligible_countries" text[],
	"source_url" text,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"verified_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scholarships_verification_chk" CHECK ("scholarships"."verification_status" in ('verified','unverified'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_user_id_scholarship_id_applications_user_id_scholarship_id_fk" FOREIGN KEY ("user_id","scholarship_id") REFERENCES "public"."applications"("user_id","scholarship_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_user_id_scholarship_id_applications_user_id_scholarship_id_fk" FOREIGN KEY ("user_id","scholarship_id") REFERENCES "public"."applications"("user_id","scholarship_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_criteria" ADD CONSTRAINT "eligibility_criteria_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_events_app_idx" ON "application_events" USING btree ("user_id","scholarship_id","id");--> statement-breakpoint
CREATE INDEX "drafts_user_updated_idx" ON "drafts" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "scholarships_deadline_idx" ON "scholarships" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "scholarships_level_idx" ON "scholarships" USING btree ("level");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));