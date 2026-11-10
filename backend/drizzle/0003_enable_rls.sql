-- Row Level Security (RLS) ligado em todas as tabelas, SEM nenhuma política de acesso.
-- Efeito: provedores que expõem o esquema "public" por uma API própria (ex.: a Data API do Supabase, com a chave "anon")
-- não conseguem ler nem alterar nada. O backend continua com acesso total, porque conecta como DONO das tabelas,
-- e o dono não é afetado pelo RLS (não usamos FORCE ROW LEVEL SECURITY).
-- Em PostgreSQL comum (Render, local, CI) não muda nada no funcionamento.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "password_resets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scholarships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "eligibility_criteria" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "application_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "application_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;
