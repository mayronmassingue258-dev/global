import { sql } from "drizzle-orm";
import { buildApp, SESSION_COOKIE } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createDb } from "../src/db/client.js";
import { seed } from "../src/db/seed.js";
import type { Email, EmailSender } from "../src/auth/email.js";

type CallInit = { method?: string; body?: unknown; raw?: string; cookie?: string | null; headers?: Record<string, string> };

/** Aplicação ligada à base de teste, com e-mails capturados e atalhos para contas e chamadas JSON. */
export async function setupTestApp(options: { authRateLimit?: number; env?: Record<string, string> } = {}) {
  const config = loadConfig({ ...process.env, ALLOW_TEST_RESET: "0", CORS_ORIGIN: "http://localhost:3000", ...options.env });
  const { db, sql: connection } = createDb(config.DATABASE_URL, { max: 2 });
  const emails: Email[] = [];
  const emailSender: EmailSender = { send: async (email) => { emails.push(email); } };
  const app = await buildApp({ config, db, emailSender, authRateLimit: options.authRateLimit ?? 10_000 });

  /** Cookie usado por padrão nas chamadas (o "estudante logado" do teste). */
  let defaultCookie: string | null = null;

  const reset = async () => {
    await db.execute(sql`truncate users, sessions, password_resets, profiles, applications, application_documents, application_events, drafts, eligibility_criteria, scholarships restart identity cascade`);
    await seed(db);
    emails.length = 0;
    defaultCookie = null;
  };
  const close = async () => {
    await app.close();
    await connection.end();
  };

  const call = async (path: string, init: CallInit = {}) => {
    const cookie = init.cookie === undefined ? defaultCookie : init.cookie;
    const res = await app.inject({
      method: (init.method ?? "GET") as "GET",
      url: `/api${path}`,
      headers: { ...(cookie ? { cookie } : {}), ...(init.raw !== undefined ? { "content-type": "application/json" } : {}), ...init.headers },
      ...(init.raw !== undefined ? { payload: init.raw } : {}),
      ...(init.body !== undefined ? { payload: init.body as object } : {})
    });
    const setCookie = res.cookies.find((c) => c.name === SESSION_COOKIE);
    return {
      status: res.statusCode,
      headers: res.headers,
      json: res.body ? JSON.parse(res.body) : undefined,
      sessionCookie: setCookie ? (setCookie.value ? `${SESSION_COOKIE}=${setCookie.value}` : "") : undefined,
      rawSetCookie: setCookie
    };
  };

  /** Cria uma conta e devolve o cookie de sessão dela. */
  const signUp = async (email = "ana@exemplo.com", password = "senha-segura-1", name = "Ana") => {
    const res = await call("/auth/register", { method: "POST", body: { name, email, password }, cookie: null });
    if (res.status !== 201 || !res.sessionCookie) throw new Error(`Falha ao criar conta de teste: ${res.status}`);
    return res.sessionCookie;
  };

  /** Cria uma conta e passa a usá-la como padrão nas próximas chamadas. */
  const signUpAndUse = async (email?: string) => {
    defaultCookie = await signUp(email);
    return defaultCookie;
  };

  return { app, db, emails, reset, close, call, signUp, signUpAndUse };
}
