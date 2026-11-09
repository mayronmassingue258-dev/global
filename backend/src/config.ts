import { z } from "zod";

/** Configuração vinda do ambiente, validada na partida: um valor errado derruba o servidor com mensagem clara. */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** Origens do frontend autorizadas (CORS e verificação de origem em POST/PUT/PATCH/DELETE), separadas por vírgula. */
  CORS_ORIGIN: z.string().default(""),
  /** Só para testes de ponta a ponta: habilita POST /api/__reset e GET /api/__emails. NUNCA em produção. */
  ALLOW_TEST_RESET: z.enum(["0", "1"]).default("0"),
  /** "1" = insere/atualiza as bolsas FICTÍCIAS de demonstração ao iniciar. Desligar quando houver dados reais. */
  SEED_DEMO_DATA: z.enum(["0", "1"]).default("1"),
  /** Endereço público do SITE (links nos e-mails, ex.: redefinição de senha). */
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Cookie de sessão só por HTTPS ("1"/"0"). Padrão: ligado em produção. */
  SESSION_COOKIE_SECURE: z.enum(["0", "1"]).optional(),
  /** Duração da sessão em dias (renovada com o uso). */
  SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  /** "log" (desenvolvimento: o e-mail aparece no log) ou "resend" (produção, requer RESEND_API_KEY). */
  EMAIL_PROVIDER: z.enum(["log", "resend"]).default("log"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("GlobalScholar <onboarding@resend.dev>"),
  /** Conexão com SSL (Render exige para conexões externas; a URL interna dispensa). */
  DATABASE_SSL: z.enum(["require", "disable"]).default("disable")
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração inválida: ${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.ALLOW_TEST_RESET === "1") {
    throw new Error("ALLOW_TEST_RESET=1 não é permitido em produção.");
  }
  if (parsed.data.EMAIL_PROVIDER === "resend" && !parsed.data.RESEND_API_KEY) {
    throw new Error("EMAIL_PROVIDER=resend exige RESEND_API_KEY.");
  }
  return parsed.data;
}

/** Cookie só por HTTPS: explícito em SESSION_COOKIE_SECURE ou, por padrão, em produção. */
export const cookieSecure = (c: Config) => (c.SESSION_COOKIE_SECURE ? c.SESSION_COOKIE_SECURE === "1" : c.NODE_ENV === "production");
