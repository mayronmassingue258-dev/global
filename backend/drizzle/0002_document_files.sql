CREATE TABLE "document_files" (
	"user_id" uuid NOT NULL,
	"scholarship_id" text NOT NULL,
	"document_name" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_files_user_id_scholarship_id_document_name_pk" PRIMARY KEY("user_id","scholarship_id","document_name")
);
--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_fk" FOREIGN KEY ("user_id","scholarship_id","document_name") REFERENCES "public"."application_documents"("user_id","scholarship_id","name") ON DELETE cascade ON UPDATE no action;