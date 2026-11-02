#!/usr/bin/env node
// Servidor LOCAL de desenvolvimento que segue o contrato provisório (docs/api-contract.md).
// Sem dependências: só Node.js 20+. Os dados de perfil e candidaturas ficam num arquivo JSON.
//
//   npm run mock-api                 # http://localhost:4000/api
//   npm run mock-api:reset           # apaga os dados gravados
//
// Variáveis: PORT (4000), HOST (127.0.0.1), MOCK_API_DATA_FILE, MOCK_API_DELAY_MS (0),
//            MOCK_API_FAIL_RATE (0 a 1), CORS_ORIGIN (*), MOCK_API_ALLOW_RESET (1; use 0 em servidor público).
//
// NÃO é o backend real: não há autenticação e existe um único "estudante".

import { createServer } from "node:http";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { evaluateEligibility } from "./eligibility.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(here, "..", "src", "mocks", "data", "scholarships.json");
const CRITERIA_FILE = join(here, "criteria.json");
export const DEFAULT_DATA_FILE = join(here, ".data", "db.json");

const STATUSES = ["Saved", "Preparing", "Ready to submit", "Submitted", "Decision received"];
const SORTS = ["deadline", "title"];
const PROFILE_MAX = { residence: 80, nationality: 80, level: 40, field: 120, grade: 60, languages: 200, interests: 1000 };
const PROFILE_REQUIRED = ["residence", "level"];
const MAX_BODY_BYTES = 100 * 1024;

const emptyProfile = () => ({ residence: "", nationality: "", level: "", field: "", grade: "", languages: "", interests: "" });
const emptyDb = () => ({ version: 1, profile: emptyProfile(), applications: [] });

class HttpError extends Error {
  constructor(status, code, fields) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** Arquivo JSON com escrita atômica (grava num temporário e renomeia) e fila para evitar corrida. */
function createStore(file) {
  let queue = Promise.resolve();
  async function read() {
    try {
      const data = JSON.parse(await readFile(file, "utf8"));
      return { ...emptyDb(), ...data, profile: { ...emptyProfile(), ...data.profile } };
    } catch (error) {
      if (error.code === "ENOENT") return emptyDb();
      throw error;
    }
  }
  async function write(db) {
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(db, null, 2));
    await rename(tmp, file);
  }
  /** Executa `fn(db)` em série; se ela devolver `{ db }`, grava. */
  function transact(fn) {
    const run = queue.then(async () => {
      const db = await read();
      const result = await fn(db);
      if (result?.save) await write(db);
      return result?.value;
    });
    queue = run.catch(() => undefined);
    return run;
  }
  return { read, transact, reset: () => rm(file, { force: true }) };
}

const summaryOf = (s) => ({ id: s.id, title: s.title, institution: s.institution, deadline: s.deadline });

function validateProfile(body) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError(400, "invalid_body");
  const fields = {};
  const profile = emptyProfile();
  for (const key of Object.keys(PROFILE_MAX)) {
    const value = body[key] ?? "";
    if (typeof value !== "string") { fields[key] = "invalid_type"; continue; }
    const trimmed = value.trim();
    if (PROFILE_REQUIRED.includes(key) && !trimmed) fields[key] = "required";
    else if (trimmed.length > PROFILE_MAX[key]) fields[key] = "too_long";
    profile[key] = trimmed;
  }
  if (Object.keys(fields).length > 0) throw new HttpError(422, "validation_failed", fields);
  return profile;
}

function listScholarships(all, params) {
  const search = (params.get("search") ?? "").trim().toLowerCase();
  const country = (params.get("country") ?? "").trim().toLowerCase();
  const level = params.get("level") ?? "";
  const sort = params.get("sort") ?? "deadline";
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "10");

  const fields = {};
  if (!SORTS.includes(sort)) fields.sort = "invalid_option";
  if (!Number.isInteger(page) || page < 1) fields.page = "out_of_range";
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) fields.pageSize = "out_of_range";
  if (Object.keys(fields).length > 0) throw new HttpError(400, "invalid_query", fields);

  const filtered = all.filter((item) => {
    const haystack = `${item.title} ${item.institution} ${item.country}`.toLowerCase();
    return (!search || haystack.includes(search)) && (!country || item.country.toLowerCase().includes(country)) && (!level || item.level === level);
  });
  filtered.sort((a, b) => (sort === "title" ? a.title.localeCompare(b.title, "pt-BR") : a.deadline.localeCompare(b.deadline)));
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length };
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "payload_too_large");
    chunks.push(chunk);
  }
  if (size === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

/**
 * Cria o servidor (sem iniciar). Usado pelo CLI abaixo e pelos testes.
 * @param {{ dataFile?: string, delayMs?: number, failRate?: number, corsOrigin?: string, log?: boolean }} options
 */
export async function createMockApi(options = {}) {
  const { dataFile = DEFAULT_DATA_FILE, delayMs = 0, failRate = 0, corsOrigin = "*", log = false, allowReset = true } = options;
  const scholarships = JSON.parse(await readFile(SEED_FILE, "utf8"));
  const criteria = JSON.parse(await readFile(CRITERIA_FILE, "utf8"));
  const byId = new Map(scholarships.map((s) => [s.id, s]));
  const store = createStore(dataFile);

  const findScholarship = (id) => {
    const item = byId.get(id);
    if (!item) throw new HttpError(404, "not_found");
    return item;
  };

  /** Tabela de rotas: [método, padrão, handler(params, query, req)] → { status, body } */
  const routes = [
    ["GET", /^\/api\/health$/, async () => ({ body: { ok: true } })],
    ["GET", /^\/api\/scholarships$/, async (_m, query) => ({ body: listScholarships(scholarships, query) })],
    ["GET", /^\/api\/scholarships\/([^/]+)$/, async ([id]) => ({ body: findScholarship(id) })],
    ["GET", /^\/api\/scholarships\/([^/]+)\/eligibility$/, async ([id]) => {
      const item = findScholarship(id);
      const db = await store.read();
      return { body: evaluateEligibility(item, criteria[id], db.profile) };
    }],
    ["GET", /^\/api\/profile$/, async () => ({ body: (await store.read()).profile })],
    ["PUT", /^\/api\/profile$/, async (_m, _q, req) => {
      const profile = validateProfile(await readJsonBody(req));
      const saved = await store.transact((db) => {
        db.profile = { ...profile, updatedAt: new Date().toISOString() };
        return { save: true, value: db.profile };
      });
      return { body: saved };
    }],
    ["GET", /^\/api\/applications$/, async () => ({ body: { items: (await store.read()).applications } })],
    ["POST", /^\/api\/applications$/, async (_m, _q, req) => {
      const body = await readJsonBody(req);
      if (typeof body?.scholarshipId !== "string" || !body.scholarshipId) throw new HttpError(422, "validation_failed", { scholarshipId: "required" });
      const item = byId.get(body.scholarshipId);
      if (!item) throw new HttpError(422, "validation_failed", { scholarshipId: "not_found" });
      return store.transact((db) => {
        const existing = db.applications.find((a) => a.id === item.id);
        if (existing) return { value: { status: 200, body: existing } };
        const created = { id: item.id, scholarship: summaryOf(item), status: "Saved", updatedAt: new Date().toISOString() };
        db.applications.push(created);
        return { save: true, value: { status: 201, body: created } };
      });
    }],
    ["PATCH", /^\/api\/applications\/([^/]+)$/, async ([id], _q, req) => {
      const body = await readJsonBody(req);
      if (!STATUSES.includes(body?.status)) throw new HttpError(422, "validation_failed", { status: "invalid_option" });
      return store.transact((db) => {
        const app = db.applications.find((a) => a.id === id);
        if (!app) throw new HttpError(404, "not_found");
        app.status = body.status;
        app.updatedAt = new Date().toISOString();
        return { save: true, value: { body: app } };
      });
    }],
    ["DELETE", /^\/api\/applications\/([^/]+)$/, async ([id]) => store.transact((db) => {
      const before = db.applications.length;
      db.applications = db.applications.filter((a) => a.id !== id);
      if (db.applications.length === before) throw new HttpError(404, "not_found");
      return { save: true, value: { status: 204 } };
    })],
    // Só para desenvolvimento e testes automatizados. NÃO faz parte do contrato.
    ["POST", /^\/api\/__reset$/, async () => {
      if (!allowReset) throw new HttpError(404, "route_not_found");
      await store.transact(async () => { await store.reset(); return {}; });
      return { status: 204 };
    }]
  ];

  const server = createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url ?? "/", "http://localhost");
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Accept,Content-Type");
    res.setHeader("Cache-Control", "no-store");

    const send = (status, body) => {
      if (body === undefined) res.writeHead(status).end();
      else res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify(body));
      if (log) console.log(`${req.method} ${url.pathname}${url.search} → ${status} (${Date.now() - started} ms)`);
    };

    if (req.method === "OPTIONS") return send(204);

    try {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      const isReset = url.pathname === "/api/__reset";
      if (!isReset && failRate > 0 && Math.random() < failRate) throw new HttpError(503, "simulated_failure");

      const matching = routes.filter(([, pattern]) => pattern.test(url.pathname));
      if (matching.length === 0) throw new HttpError(404, "route_not_found");
      const route = matching.find(([method]) => method === req.method);
      if (!route) {
        res.setHeader("Allow", matching.map(([m]) => m).join(", "));
        throw new HttpError(405, "method_not_allowed");
      }
      const params = route[1].exec(url.pathname).slice(1).map(decodeURIComponent);
      const result = await route[2](params, url.searchParams, req);
      send(result.status ?? 200, result.body);
    } catch (error) {
      if (error instanceof HttpError) {
        send(error.status, { error: { code: error.code, message: error.code, ...(error.fields ? { fields: error.fields } : {}) } });
      } else {
        console.error(error);
        send(500, { error: { code: "internal_error", message: "internal_error" } });
      }
    }
  });

  return server;
}

// Execução direta: `node mock-api/server.mjs [--reset]`
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const dataFile = process.env.MOCK_API_DATA_FILE || DEFAULT_DATA_FILE;
  if (process.argv.includes("--reset")) {
    await rm(dataFile, { force: true });
    console.log(`Dados apagados: ${dataFile}`);
    process.exit(0);
  }
  const port = Number(process.env.PORT || 4000);
  const host = process.env.HOST || "127.0.0.1";
  const server = await createMockApi({
    dataFile,
    delayMs: Number(process.env.MOCK_API_DELAY_MS || 0),
    failRate: Number(process.env.MOCK_API_FAIL_RATE || 0),
    corsOrigin: process.env.CORS_ORIGIN || "*",
    log: process.env.MOCK_API_LOG !== "0",
    allowReset: process.env.MOCK_API_ALLOW_RESET !== "0"
  });
  server.listen(port, host, () => {
    console.log(`API local em http://${host === "0.0.0.0" ? "localhost" : host}:${port}/api`);
    console.log(`Dados gravados em ${dataFile}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
