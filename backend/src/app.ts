import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { hashToken } from "./auth/tokens.js";
import { cookieSecure, type Config } from "./config.js";
import type { Database } from "./db/client.js";
import { createEmailSender, sentEmails, type EmailSender } from "./auth/email.js";
import { HttpError, errorBody, notFound } from "./lib/errors.js";
import { parseApplicationCreate, parseApplicationPatch, parseDraft, parseListQuery, parseProfile } from "./lib/validation.js";
import { getEligibility, getScholarshipRow, listScholarships, toScholarship } from "./services/scholarships.js";
import { getProfile, putProfile } from "./services/profile.js";
import { createApplication, deleteApplication, getApplication, listApplications, patchApplication } from "./services/applications.js";
import { createDraft, deleteDraft, getDraft, listDrafts, updateDraft } from "./services/drafts.js";
import { MAX_FILE_BYTES, deleteFile, readFile, saveFile } from "./services/files.js";
import { deleteAccount, exportAccount } from "./services/account.js";
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

/**
 * Bloqueio por CONTA: 10 senhas erradas para o mesmo e-mail em 15 minutos → novas tentativas recusadas até a janela passar.
 * Protege contra força bruta mesmo quando o atacante troca de IP. (Memória do processo: basta para uma instância.)
 */
export function createLoginThrottle(maxFailures = 10, windowMs = 15 * 60 * 1000) {
  const failures = new Map<string, { count: number; since: number }>();
  const current = (email: string) => {
    const entry = failures.get(email);
    if (entry && Date.now() - entry.since > windowMs) {
      failures.delete(email);
      return undefined;
    }
    return entry;
  };
  return {
    blocked: (email: string) => (current(email)?.count ?? 0) >= maxFailures,
    fail: (email: string) => {
      const entry = current(email);
      failures.set(email, entry ? { count: entry.count + 1, since: entry.since } : { count: 1, since: Date.now() });
      if (failures.size > 10_000) failures.delete(failures.keys().next().value!);
    },
    reset: (email: string) => {
      failures.delete(email);
    }
  };
}

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
  await app.register(multipart, { limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 0, parts: 2 } });
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-site" } });
  await app.register(cors, { origin: origins.length > 0 ? origins : false, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] });
  const internalSecret = config.INTERNAL_API_SECRET ? Buffer.from(config.INTERNAL_API_SECRET) : null;
  const isInternal = (req: FastifyRequest) => {
    const given = req.headers["x-gs-internal"];
    if (!internalSecret || typeof given !== "string") return false;
    const buf = Buffer.from(given);
    return buf.length === internalSecret.length && timingSafeEqual(buf, internalSecret);
  };
  await app.register(rateLimit, {
    // Testes de ponta a ponta: tudo vem de 127.0.0.1 em alta velocidade; os limites têm testes próprios.
    max: config.ALLOW_TEST_RESET === "1" ? 100_000 : 600,
    timeWindow: "1 minute",
    // Estudante logado conta pela própria sessão; visitante, pelo IP. O servidor do site (renderização) fica de fora.
    keyGenerator: (req) => {
      const token = req.cookies?.[SESSION_COOKIE];
      return token ? `s:${hashToken(token).slice(0, 24)}` : `ip:${req.ip}`;
    },
    allowList: (req) => isInternal(req),
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
    if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE" || error.code === "FST_REQ_FILE_TOO_LARGE") return reply.status(413).send(errorBody("payload_too_large"));
    if (error.code === "FST_INVALID_MULTIPART_CONTENT_TYPE" || error.code === "FST_FILES_LIMIT" || error.code === "FST_PARTS_LIMIT" || error.code === "FST_FIELDS_LIMIT") {
      return reply.status(400).send(errorBody("invalid_body"));
    }
    if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") return reply.status(415).send(errorBody("unsupported_media_type"));
    if (error.statusCode === 429) return reply.status(429).send(error);
    req.log.error(error);
    return reply.status(500).send(errorBody("internal_error"));
  });

  const id = (req: FastifyRequest) => decodeURIComponent((req.params as { id: string }).id);
  const loginThrottle = createLoginThrottle();
  // Rotas de conta: sempre por IP (não por sessão), e sem exceção para a chave interna.
  const authLimit = { config: { rateLimit: { max: authRateLimit, timeWindow: "1 minute", keyGenerator: (req: FastifyRequest) => `auth:${req.ip}`, allowList: () => false } } };

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
      const input = parseLogin(req.body);
      if (loginThrottle.blocked(input.email)) throw new HttpError(429, "rate_limited");
      let user: PublicUser;
      try {
        user = await login(db, input);
      } catch (error) {
        if (error instanceof HttpError && error.code === "invalid_credentials") loginThrottle.fail(input.email);
        throw error;
      }
      loginThrottle.reset(input.email);
      setSessionCookie(reply, await createSession(db, user.id, req.headers["user-agent"] ?? "", config.SESSION_DAYS));
      return { user };
    });
    api.post("/auth/logout", async (req, reply) => {
      if (req.sessionToken) await destroySession(db, req.sessionToken);
      clearSessionCookie(reply);
      return reply.status(204).send();
    });
    api.get("/auth/me/export", async (req, reply) => {
      const data = await exportAccount(db, userId(req));
      const day = data.exportedAt.slice(0, 10);
      return reply.header("Content-Disposition", `attachment; filename="globalscholar-meus-dados-${day}.json"`).send(data);
    });
    api.delete("/auth/me", authLimit, async (req, reply) => {
      await deleteAccount(db, userId(req), req.body);
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

    // Arquivo de um item do checklist: multipart/form-data, campo "file" (até 10 MB; PDF, JPG, PNG ou DOCX pelo conteúdo).
    const fileParams = (req: FastifyRequest) => {
      const p = req.params as { id: string; name: string };
      return { scholarshipId: decodeURIComponent(p.id), documentName: decodeURIComponent(p.name) };
    };
    api.put("/applications/:id/documents/:name/file", async (req) => {
      const owner = userId(req);
      if (!req.isMultipart()) throw new HttpError(400, "invalid_body");
      const part = await req.file();
      if (!part || part.fieldname !== "file") throw new HttpError(422, "validation_failed", { file: "required" });
      const buffer = await part.toBuffer();
      const { scholarshipId, documentName } = fileParams(req);
      return saveFile(db, owner, scholarshipId, documentName, { fileName: part.filename, buffer });
    });
    api.get("/applications/:id/documents/:name/file", async (req, reply) => {
      const { scholarshipId, documentName } = fileParams(req);
      const file = await readFile(db, userId(req), scholarshipId, documentName);
      return reply
        .header("Content-Type", file.contentType)
        .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
        // O arquivo nunca é interpretado como página do site, mesmo se alguém tentar abri-lo direto.
        .header("Content-Security-Policy", "default-src 'none'; sandbox")
        .send(file.content);
    });
    api.delete("/applications/:id/documents/:name/file", async (req, reply) => {
      const { scholarshipId, documentName } = fileParams(req);
      await deleteFile(db, userId(req), scholarshipId, documentName);
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
