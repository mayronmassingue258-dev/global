import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { sql } from "drizzle-orm";
import type { Config } from "./config.js";
import type { Database } from "./db/client.js";
import { DEMO_USER_ID } from "./db/seed.js";
import { HttpError, errorBody, notFound } from "./lib/errors.js";
import { parseApplicationCreate, parseApplicationPatch, parseDraft, parseListQuery, parseProfile } from "./lib/validation.js";
import { getEligibility, getScholarshipRow, listScholarships, toScholarship } from "./services/scholarships.js";
import { getProfile, putProfile } from "./services/profile.js";
import { createApplication, deleteApplication, getApplication, listApplications, patchApplication } from "./services/applications.js";
import { createDraft, deleteDraft, getDraft, listDrafts, updateDraft } from "./services/drafts.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Estudante da requisição. B1: sempre o de demonstração. B2: vem da sessão. */
    userId: string;
  }
}

type Deps = { config: Config; db: Database; resetDatabase?: () => Promise<void> };

/** Monta a aplicação sem abrir porta (os testes usam `app.inject`). */
export async function buildApp({ config, db, resetDatabase }: Deps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.LOG_LEVEL === "silent" ? false : { level: config.LOG_LEVEL, redact: ["req.headers.authorization", "req.headers.cookie"] },
    bodyLimit: 512 * 1024,
    trustProxy: true // atrás do proxy do Render: IP real do cliente para o limite de requisições
  });

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-site" } });
  const origins = config.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  await app.register(cors, { origin: origins.length > 0 ? origins : false, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    errorResponseBuilder: (_req, ctx) => ({ statusCode: 429, ...errorBody("rate_limited"), retryAfter: ctx.after })
  });

  app.decorateRequest("userId", "");
  app.addHook("onRequest", async (req) => {
    req.userId = DEMO_USER_ID;
  });

  // Respostas de dados do estudante nunca devem ficar em cache (contrato, seção 1).
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });

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

  await app.register(async (api) => {
    api.get("/health", async (_req, reply) => {
      try {
        await db.execute(sql`select 1`);
        return { ok: true };
      } catch {
        return reply.status(503).send({ ok: false });
      }
    });

    api.get("/scholarships", async (req) => listScholarships(db, parseListQuery(req.query as Record<string, unknown>)));
    api.get("/scholarships/:id", async (req) => {
      const row = await getScholarshipRow(db, id(req));
      if (!row) throw notFound();
      return toScholarship(row);
    });
    api.get("/scholarships/:id/eligibility", async (req) => {
      const result = await getEligibility(db, req.userId, id(req));
      if (!result) throw notFound();
      return result;
    });

    api.get("/profile", async (req) => getProfile(db, req.userId));
    api.put("/profile", async (req) => putProfile(db, req.userId, parseProfile(req.body)));

    api.get("/applications", async (req) => ({ items: await listApplications(db, req.userId) }));
    api.post("/applications", async (req, reply) => {
      const { created, application } = await createApplication(db, req.userId, parseApplicationCreate(req.body));
      return reply.status(created ? 201 : 200).send(application);
    });
    api.get("/applications/:id", async (req) => {
      const application = await getApplication(db, req.userId, id(req));
      if (!application) throw notFound();
      return application;
    });
    api.patch("/applications/:id", async (req) => patchApplication(db, req.userId, id(req), parseApplicationPatch(req.body)));
    api.delete("/applications/:id", async (req, reply) => {
      await deleteApplication(db, req.userId, id(req));
      return reply.status(204).send();
    });

    api.get("/drafts", async (req) => ({ items: await listDrafts(db, req.userId) }));
    api.post("/drafts", async (req, reply) => reply.status(201).send(await createDraft(db, req.userId, parseDraft(req.body))));
    api.get("/drafts/:id", async (req) => getDraft(db, req.userId, id(req)));
    api.put("/drafts/:id", async (req) => updateDraft(db, req.userId, id(req), parseDraft(req.body)));
    api.delete("/drafts/:id", async (req, reply) => {
      await deleteDraft(db, req.userId, id(req));
      return reply.status(204).send();
    });

    // Só para testes de ponta a ponta (ALLOW_TEST_RESET=1, proibido em produção). Fora do contrato.
    if (config.ALLOW_TEST_RESET === "1" && resetDatabase) {
      api.post("/__reset", async (_req, reply) => {
        await resetDatabase();
        return reply.status(204).send();
      });
    }
  }, { prefix: "/api" });

  return app;
}
