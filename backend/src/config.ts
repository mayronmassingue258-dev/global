import { z } from "zod";

/** Configuração vinda do ambiente, validada na partida: um valor errado derruba o servidor com mensagem clara. */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  /** Origens do frontend autorizadas (CORS), separadas por vírgula. Vazio = nenhuma origem externa. */
  CORS_ORIGIN: z.string().default(""),
  /** Só para testes de ponta a ponta: habilita POST /api/__reset. NUNCA em produção. */
  ALLOW_TEST_RESET: z.enum(["0", "1"]).default("0"),
  /** "1" = insere/atualiza as bolsas FICTÍCIAS de demonstração ao iniciar. Desligar quando houver dados reais. */
  SEED_DEMO_DATA: z.enum(["0", "1"]).default("1"),
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
  return parsed.data;
}
