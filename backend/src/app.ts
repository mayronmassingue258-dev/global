import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { sql } from "drizzle-orm";
import { cookieSecure, type Config } from "./config.js";
import type { Database } from "./db/client.js";
import { createEmailSender, sentEmails, type EmailSender } from "./auth/email.js";
import { HttpError, errorBody, notFound } from "./lib/errors.js";
import { parseApplicationCreate, parseApplicationPatch, parseDraft, parseListQuery, parseProfile } from "./lib/validation.js";
import { getEligibility, getScholarshipRow, listScholarships, toScholarship } from "./services/scholarships.js";
import { getProfile, putProfile } from "./services/profile.js";
import { createApplication, deleteApplication, getApplication, listApplications, patchApplication } from "./services/applications.js";
import { createDraft, deleteDraft, getDraft, listDrafts, updateDraft } from "./services/drafts.js";
import {
  createSession, destroySession, login, parseForgot, parseLogin, parseRegister, parseReset, register,
  requestPasswordReset, resetPassword, resolveSession, type PublicUser
} from "./services/auth.js";

export const SESSION_COOKIE = "gs_session";

declare module "fastify" {
  interface FastifyRequest {
    /** Estudante autenticado pela sessão (cookie), ou null. */
    user: PublicUser | null;
    sessionToken: string | null;
  }
}

type Deps = {
  config: Config;
  db: Database;
  resetDatabase?: () => Promise<void>;
  emailSender?: EmailSender;
  /** Tentativas por minuto e por IP nas rotas de login/cadastro/senha. */
  authRateLimit?: number;
};

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Monta a aplicação sem abrir porta (os testes usam `app.inject`). */
export async function buildApp({ config, db, resetDatabase, emailSender, authRateLimit = 10 }: Deps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.LOG_LEVEL === "silent" ? false : { level: config.LOG_LEVEL, redact: ["req.headers.authorization", "req.headers.cookie", "res.headers[\"set-cookie\"]"] },
    bodyLimit: 512 * 1024,
    trustProxy: true // atrás do proxy do Render: IP real do cliente para o limite de requisições
  });
  const sender = emailSender ?? createEmailSender({ provider: config.EMAIL_PROVIDER, apiKey: config.RESEND_API_KEY, from: config.EMAIL_FROM, log: (m) => app.log.info(m) });
  const origins = config.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);

  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-site" } });
  await app.register(cors, { origin: origins.length > 0 ? origins : false, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    errorResponseBuilder: (_req, ctx) => ({ statusCode: 429, ...errorBody("rate_limited"), retryAfter: ctx.after })
  });

  app.decorateRequest("user", null);
  app.decorateRequest("sessionToken", null);

  /**
   * Proteção contra CSRF (um site malicioso enviando formulários em nome do estudante):
   * 1) o cookie é SameSite=Lax; 2) toda alteração vinda de navegador precisa ter Origin entre as origens do site.
   * Chamadas servidor-a-servidor (sem Origin) seguem permitidas: dependem do cookie, que o navegador não envia entre sites.
   */
  app.addHook("onRequest", async (req) => {
    if (!UNSAFE.has(req.method)) return;
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) throw new HttpError(403, "forbidden_origin");
  });

  app.addHook("preHandler", async (req) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    req.sessionToken = token;
    req.user = await resolveSession(db, token, config.SESSION_DAYS);
  });

  // Respostas de dados do estudante nunca devem ficar em cache (contrato, seção 1).
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  const setSessionCookie = (reply: FastifyReply, token: string) =>
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: cookieSecure(config),
      sameSite: "lax",
      path: "/",
      maxAge: config.SESSION_DAYS * 24 * 60 * 60
    });
  const clearSessionCookie = (reply: FastifyReply) =>
    reply.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: cookieSecure(config), sameSite: "lax", path: "/" });

  /** Exige login. Devolve o id do estudante (cada consulta abaixo é filtrada por ele). */
  const userId = (req: FastifyRequest): string => {
    if (!req.user) throw new HttpError(401, "unauthenticated");
    return req.user.id;
  };

  // Rotas conhecidas, para responder 405 (método errado) em vez de 404.
  const known: { method: string; pattern: RegExp }[] = [];
  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const pattern = new RegExp(`^${route.url.replace(/:[^/]+/g, "[^/]+")}$`);
    for (const method of methods) if (method !== "HEAD" && method !== "OPTIONS") known.push({ method, pattern });
  });

  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split("?")[0] ?? "";
    const allowed = [...new Set(known.filter((r) => r.pattern.test(path)).map((r) => r.method))];
    if (allowed.length > 0) return reply.status(405).header("Allow", allowed.join(", ")).send(errorBody("method_not_allowed"));
    return reply.status(404).send(errorBody("route_not_found"));
  });

  app.setErrorHandler((error: Error & { code?: string; statusCode?: number }, req, reply) => {
    if (error instanceof HttpError) return reply.status(error.statusCode).send(errorBody(error.code, error.fields));
    if (error.code === "FST_ERR_CTP_INVALID_JSON_BODY" || error.name === "SyntaxError") return reply.status(400).send(errorBody("invalid_json"));
    if (error.code === "FST_ERR_CTP_EMPTY_JSON_BODY") return reply.status(400).send(errorBody("invalid_body"));
    if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") return reply.status(413).send(errorBody("payload_too_large"));
    if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") return reply.status(415).send(errorBody("unsupported_media_type"));
    if (error.statusCode === 429) return reply.status(429).send(error);
    req.log.error(error);
    return reply.status(500).send(errorBody("internal_error"));
  });

  const id = (req: FastifyRequest) => decodeURIComponent((req.params as { id: string }).id);
  const authLimit = { config: { rateLimit: { max: authRateLimit, timeWindow: "1 minute" } } };

  await app.register(async (api) => {
    api.get("/health", async (_req, reply) => {
      try {
        await db.execute(sql`select 1`);
        return { ok: true };
      } catch {
        return reply.status(503).send({ ok: false });
      }
    });

    // ── Contas ───────────────────────────────────────────────────────────────
    api.post("/auth/register", authLimit, async (req, reply) => {
      const user = await register(db, parseRegister(req.body));
      setSessionCookie(reply, await createSession(db, user.id, req.headers["user-agent"] ?? "", config.SESSION_DAYS));
      return reply.status(201).send({ user });
    });
    api.post("/auth/login", authLimit, async (req, reply) => {
      const user = await login(db, parseLogin(req.body));
      setSessionCookie(reply, await createSession(db, user.id, req.headers["user-agent"] ?? "", config.SESSION_DAYS));
      return { user };
    });
    api.post("/auth/logout", async (req, reply) => {
      if (req.sessionToken) await destroySession(db, req.sessionToken);
      clearSessionCookie(reply);
      return reply.status(204).send();
    });
    api.get("/auth/me", async (req, reply) => {
      if (!req.user) {
        if (req.sessionToken) clearSessionCookie(reply); // cookie de uma sessão que já não existe
        throw new HttpError(401, "unauthenticated");
      }
      return { user: req.user };
    });
    api.post("/auth/forgot-password", authLimit, async (req, reply) => {
      const { email } = parseForgot(req.body);
      try {
        await requestPasswordReset(db, email, sender, config.APP_URL);
      } catch (error) {
        // Falha do provedor de e-mail: registra, mas não revela ao cliente se a conta existe.
        req.log.error(error);
      }
      return reply.status(204).send();
    });
    api.post("/auth/reset-password", authLimit, async (req, reply) => {
      await resetPassword(db, parseReset(req.body));
      clearSessionCookie(reply);
      return reply.status(204).send();
    });

    // ── Bolsas (públicas) ────────────────────────────────────────────────────
    api.get("/scholarships", async (req) => listScholarships(db, parseListQuery(req.query as Record<string, unknown>)));
    api.get("/scholarships/:id", async (req) => {
      const row = await getScholarshipRow(db, id(req));
      if (!row) throw notFound();
      return toScholarship(row);
    });

    // ── Dados do estudante (exigem login; sempre filtrados pelo id da sessão) ─
    api.get("/scholarships/:id/eligibility", async (req) => {
      const result = await getEligibility(db, userId(req), id(req));
      if (!result) throw notFound();
      return result;
    });

    api.get("/profile", async (req) => getProfile(db, userId(req)));
    api.put("/profile", async (req) => putProfile(db, userId(req), parseProfile(req.body)));

    api.get("/applications", async (req) => ({ items: await listApplications(db, userId(req)) }));
    api.post("/applications", async (req, reply) => {
      const { created, application } = await createApplication(db, userId(req), parseApplicationCreate(req.body));
      return reply.status(created ? 201 : 200).send(application);
    });
    api.get("/applications/:id", async (req) => {
      const application = await getApplication(db, userId(req), id(req));
      if (!application) throw notFound();
      return application;
    });
    api.patch("/applications/:id", async (req) => patchApplication(db, userId(req), id(req), parseApplicationPatch(req.body)));
    api.delete("/applications/:id", async (req, reply) => {
      await deleteApplication(db, userId(req), id(req));
      return reply.status(204).send();
    });

    api.get("/drafts", async (req) => ({ items: await listDrafts(db, userId(req)) }));
    api.post("/drafts", async (req, reply) => reply.status(201).send(await createDraft(db, userId(req), parseDraft(req.body))));
    api.get("/drafts/:id", async (req) => getDraft(db, userId(req), id(req)));
    api.put("/drafts/:id", async (req) => updateDraft(db, userId(req), id(req), parseDraft(req.body)));
    api.delete("/drafts/:id", async (req, reply) => {
      await deleteDraft(db, userId(req), id(req));
      return reply.status(204).send();
    });

    // Só para testes de ponta a ponta (ALLOW_TEST_RESET=1, proibido em produção). Fora do contrato.
    if (config.ALLOW_TEST_RESET === "1") {
      if (resetDatabase) {
        api.post("/__reset", async (_req, reply) => {
          await resetDatabase();
          sentEmails.length = 0;
          return reply.status(204).send();
        });
      }
      api.get("/__emails", async () => ({ items: sentEmails }));
    }
  }, { prefix: "/api" });

  return app;
}
