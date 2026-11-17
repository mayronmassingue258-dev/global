CREATE TABLE "scholarship_reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scholarship_id" text NOT NULL,
	"user_id" uuid,
	"reason" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "scholarship_reports_reason_chk" CHECK ("scholarship_reports"."reason" in ('broken_link','wrong_deadline','wrong_info','closed','scam','other'))
);
--> statement-breakpoint
DROP TABLE "eligibility_criteria" CASCADE;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "data" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- Bolsas já existentes recebem critérios provisórios e ficam OCULTAS até serem reimportadas com critérios reais
-- (as de demonstração "amostra-*" são atualizadas pelo seed logo na partida).
ALTER TABLE "scholarships" ADD COLUMN "match" jsonb DEFAULT '{"levels":["bachelor","master","phd"]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scholarships" ALTER COLUMN "match" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "hidden_reason" text;--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "origin" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "scholarships" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'student' NOT NULL;--> statement-breakpoint
ALTER TABLE "scholarship_reports" ADD CONSTRAINT "scholarship_reports_scholarship_id_scholarships_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship_reports" ADD CONSTRAINT "scholarship_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scholarship_reports_open_idx" ON "scholarship_reports" USING btree ("scholarship_id") WHERE "scholarship_reports"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "scholarships_status_idx" ON "scholarships" USING btree ("status");--> statement-breakpoint
UPDATE "scholarships" SET "status" = 'hidden', "hidden_reason" = 'criteria_missing' WHERE "id" NOT LIKE 'amostra-%';--> statement-breakpoint
UPDATE "profiles" SET "data" = jsonb_build_object('goals', left("interests", 1000)) WHERE "interests" <> '';--> statement-breakpoint
ALTER TABLE "scholarship_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "residence";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "nationality";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "level";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "field";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "grade";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "languages";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "interests";--> statement-breakpoint
ALTER TABLE "scholarships" DROP COLUMN "eligible_countries";--> statement-breakpoint
ALTER TABLE "scholarships" ADD CONSTRAINT "scholarships_status_chk" CHECK ("scholarships"."status" in ('active','hidden'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_chk" CHECK ("users"."role" in ('student','admin'));