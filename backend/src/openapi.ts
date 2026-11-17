/**
 * Especificação OpenAPI 3.1 da API (documentação interativa em /api/docs, JSON em /api/docs/json).
 * Mantida à mão junto com o docs/api-contract.md. Um teste (test/openapi.test.ts) garante que toda rota do
 * servidor está documentada aqui, e que nada documentado deixou de existir.
 */
import { z } from "zod";
import { matchSchema, profileSchema } from "./matching/model.js";

/** Perfil e critérios vêm dos esquemas zod (fonte única: o que a API valida é o que a documentação mostra). */
const fromZod = (schema: z.ZodTypeAny) => {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  return rest;
};

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const error = (description: string) => ({ description, ...json(ref("Error")) });
const ok = (description: string, schema: object) => ({ description, ...json(schema) });
const noContent = { description: "Sem conteúdo" };
const idParam = { name: "id", in: "path", required: true, schema: { type: "string" } };
const docParam = { name: "name", in: "path", required: true, description: "Nome do item do checklist (codificado na URL)", schema: { type: "string" } };
const session = [{ session: [] }];
const common401 = { 401: error("Sem sessão válida (`unauthenticated`)") };
const common422 = { 422: error("Campos inválidos (`validation_failed`, com `fields`)") };

const strings = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, { type: "string" }]));

export const openapiDocument = {
  openapi: "3.1.0",
  info: {
    title: "GlobalScholar API",
    version: "2.0.0",
    description:
      "API do GlobalScholar. Contrato completo, regras e decisões em docs/api-contract.md. " +
      "Autenticação por cookie de sessão HttpOnly `gs_session` (posto por /auth/register e /auth/login). " +
      "Erros sempre no envelope `{ error: { code, message, fields? } }`."
  },
  servers: [{ url: "/api" }],
  tags: [
    { name: "Bolsas", description: "Públicas" },
    { name: "Contas" },
    { name: "Perfil" },
    { name: "Candidaturas" },
    { name: "Rascunhos" },
    { name: "Recomendações" },
    { name: "Administração", description: "Só contas com role = admin" },
    { name: "Operação" }
  ],
  components: {
    securitySchemes: { session: { type: "apiKey", in: "cookie", name: "gs_session" } },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: { code: { type: "string" }, message: { type: "string" }, fields: { type: "object", additionalProperties: { type: "string" } } }
          }
        }
      },
      Scholarship: {
        type: "object",
        required: ["id", "title", "institution", "country", "level", "fundingType", "funding", "deadline", "summary", "requirements", "requiredDocuments", "match", "status", "origin", "verification"],
        properties: {
          ...strings("id", "title", "institution", "country", "level", "fundingType", "funding", "summary", "applicationProcess", "deadlineTimezone"),
          deadline: { type: "string", format: "date" },
          requirements: { type: "array", items: { type: "string" } },
          requiredDocuments: { type: "array", items: { type: "string" } },
          sourceUrl: { type: "string", format: "uri" },
          match: ref("ScholarshipMatch"),
          status: { enum: ["active", "hidden"], description: "Bolsas ocultas não aparecem na busca nem nas recomendações" },
          origin: { enum: ["manual", "discovery", "demo"] },
          lastCheckedAt: { type: "string", format: "date-time" },
          verification: { type: "object", required: ["status"], properties: { status: { enum: ["verified", "unverified"] }, verifiedAt: { type: "string", format: "date" } } }
        }
      },
      ScholarshipPage: { type: "object", required: ["items", "total"], properties: { items: { type: "array", items: ref("Scholarship") }, total: { type: "integer" } } },
      ScholarshipMatch: { description: "Critérios de compatibilidade da bolsa (códigos; o site traduz).", ...fromZod(matchSchema) },
      Reason: {
        type: "object",
        required: ["kind", "code"],
        description: "Motivo em código (ex.: nationality_not_eligible, language_gap) com parâmetros; o site escreve a frase em PT/EN. Lista em docs/api-contract.md.",
        properties: { kind: { enum: ["met", "gap", "missing", "failed", "info"] }, code: { type: "string" }, params: { type: "object" } }
      },
      EligibilityResult: {
        type: "object",
        required: ["scholarshipId", "status", "score", "fit", "reasons"],
        properties: {
          scholarshipId: { type: "string" },
          status: { enum: ["eligible", "possible", "not_eligible"] },
          score: { type: "integer", minimum: 0, maximum: 100 },
          fit: { enum: ["high", "medium", "low"] },
          reasons: { type: "array", items: ref("Reason") }
        }
      },
      Recommendations: {
        type: "object",
        required: ["considered", "excluded", "items"],
        properties: {
          considered: { type: "integer", description: "Bolsas ativas com prazo aberto avaliadas" },
          excluded: { type: "integer", description: "Eliminadas por um requisito obrigatório" },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["scholarship", "eligibility", "score", "fit", "reasons", "saved"],
              properties: {
                scholarship: ref("Scholarship"), eligibility: { enum: ["eligible", "possible"] }, score: { type: "integer" },
                fit: { enum: ["high", "medium", "low"] }, reasons: { type: "array", items: ref("Reason") }, saved: { type: "boolean" }
              }
            }
          }
        }
      },
      ProfileInput: { description: "Perfil completo (PUT substitui tudo; campos ausentes voltam ao padrão).", ...fromZod(profileSchema) },
      Profile: {
        allOf: [ref("ProfileInput"), {
          type: "object",
          required: ["completeness"],
          properties: {
            completeness: { type: "object", required: ["percent", "missing"], properties: { percent: { type: "integer" }, missing: { type: "array", items: { type: "string" } } } },
            updatedAt: { type: "string", format: "date-time" }
          }
        }]
      },
      AdminScholarship: { allOf: [ref("Scholarship"), { type: "object", required: ["openReports"], properties: { openReports: { type: "integer" }, hiddenReason: { type: "string" } } }] },
      AttachedFile: { type: "object", required: ["name", "size", "type", "uploadedAt"], properties: { ...strings("name", "type"), size: { type: "integer" }, uploadedAt: { type: "string", format: "date-time" } } },
      TimelineEvent: {
        type: "object",
        required: ["at", "kind"],
        properties: { at: { type: "string", format: "date-time" }, kind: { enum: ["created", "status", "document", "notes"] }, status: { type: "string" }, document: { type: "string" }, done: { type: "boolean" } }
      },
      ApplicationStatus: { enum: ["Saved", "Preparing", "Ready to submit", "Submitted", "Decision received"] },
      Application: {
        type: "object",
        required: ["id", "scholarship", "status", "documents", "notes", "timeline", "updatedAt"],
        properties: {
          id: { type: "string", description: "Igual ao id da bolsa" },
          scholarship: { type: "object", required: ["id", "title", "institution", "deadline"], properties: { ...strings("id", "title", "institution"), deadline: { type: "string", format: "date" } } },
          status: ref("ApplicationStatus"),
          documents: { type: "array", items: { type: "object", required: ["name", "done"], properties: { name: { type: "string" }, done: { type: "boolean" }, file: ref("AttachedFile") } } },
          notes: { type: "string", maxLength: 5000 },
          timeline: { type: "array", items: ref("TimelineEvent") },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      ApplicationPatch: {
        type: "object",
        description: "Envie só o que mudou (pelo menos um campo).",
        properties: {
          status: ref("ApplicationStatus"),
          notes: { type: "string", maxLength: 5000 },
          documents: { type: "array", items: { type: "object", required: ["name", "done"], properties: { name: { type: "string" }, done: { type: "boolean" } } } }
        }
      },
      DraftInput: {
        type: "object",
        required: ["type", "title"],
        properties: {
          type: { enum: ["motivation_letter", "academic_cv", "personal_statement", "document_review"] },
          title: { type: "string", maxLength: 120 },
          program: { type: "string", maxLength: 160 },
          sections: { type: "object", additionalProperties: { type: "string", maxLength: 20000 } }
        }
      },
      Draft: { allOf: [ref("DraftInput"), { type: "object", required: ["id", "createdAt", "updatedAt"], properties: { id: { type: "string" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } }] },
      User: { type: "object", required: ["id", "email", "name"], properties: { ...strings("id", "email", "name"), role: { const: "admin", description: "Só presente em contas de administração" } } },
      UserResponse: { type: "object", required: ["user"], properties: { user: ref("User") } }
    }
  },
  paths: {
    "/health": {
      get: { tags: ["Operação"], summary: "Saúde da API e da base de dados", responses: { 200: ok("Tudo certo", { type: "object", properties: { ok: { const: true } } }), 503: ok("Base de dados indisponível", { type: "object", properties: { ok: { const: false } } }) } }
    },
    "/scholarships": {
      get: {
        tags: ["Bolsas"],
        summary: "Buscar bolsas",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "country", in: "query", schema: { type: "string" } },
          { name: "level", in: "query", schema: { type: "string" } },
          { name: "sort", in: "query", schema: { enum: ["deadline", "title"], default: "deadline" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 10 } }
        ],
        responses: { 200: ok("Página de resultados", ref("ScholarshipPage")), 400: error("Parâmetros inválidos (`invalid_query`)") }
      }
    },
    "/scholarships/{id}": {
      get: { tags: ["Bolsas"], summary: "Detalhe da bolsa", parameters: [idParam], responses: { 200: ok("Bolsa", ref("Scholarship")), 404: error("Não encontrada") } }
    },
    "/scholarships/{id}/eligibility": {
      get: { tags: ["Bolsas"], summary: "Elegibilidade do estudante logado", security: session, parameters: [idParam], responses: { 200: ok("Avaliação", ref("EligibilityResult")), ...common401, 404: error("Bolsa não encontrada") } }
    },
    "/scholarships/{id}/reports": {
      post: {
        tags: ["Bolsas"], summary: "Reportar erro na bolsa", security: session, parameters: [idParam],
        description: "Com 3 estudantes diferentes reportando link quebrado, bolsa encerrada ou golpe, a bolsa sai do ar até um admin conferir.",
        requestBody: json({ type: "object", required: ["reason"], properties: { reason: { enum: ["broken_link", "wrong_deadline", "wrong_info", "closed", "scam", "other"] }, message: { type: "string", maxLength: 1000 } } }),
        responses: { 204: noContent, ...common401, 404: error("Bolsa não encontrada"), ...common422, 429: error("Muitos relatos (20 por hora)") }
      }
    },
    "/recommendations": {
      get: {
        tags: ["Recomendações"], summary: "Bolsas mais compatíveis com o meu perfil", security: session,
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 30, default: 10 } }],
        responses: { 200: ok("Da maior nota para a menor", ref("Recommendations")), 400: error("`limit` fora de 1–30"), ...common401 }
      }
    },
    "/admin/scholarships": {
      get: {
        tags: ["Administração"], summary: "Todas as bolsas (inclusive ocultas), reportadas primeiro", security: session,
        parameters: [
          { name: "status", in: "query", schema: { enum: ["all", "active", "hidden"], default: "all" } },
          { name: "verification", in: "query", schema: { enum: ["all", "verified", "unverified"], default: "all" } },
          { name: "reported", in: "query", schema: { enum: ["0", "1"], default: "0" } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } }
        ],
        responses: { 200: ok("Página", { type: "object", properties: { items: { type: "array", items: ref("AdminScholarship") }, total: { type: "integer" } } }), ...common401, 403: error("Não é administrador") }
      }
    },
    "/admin/scholarships/{id}": {
      put: { tags: ["Administração"], summary: "Criar ou substituir bolsa (formato do importador, sem o id)", security: session, parameters: [idParam], requestBody: json({ type: "object" }), responses: { 200: ok("Atualizada", ref("Scholarship")), 201: ok("Criada", ref("Scholarship")), ...common401, 403: error("Não é administrador"), ...common422 } },
      patch: {
        tags: ["Administração"], summary: "Verificar / ocultar / reativar", security: session, parameters: [idParam],
        requestBody: json({ type: "object", properties: { status: { enum: ["active", "hidden"] }, verification: { enum: ["verified", "unverified"] }, hiddenReason: { type: "string", maxLength: 200 } } }),
        responses: { 200: ok("Bolsa", ref("Scholarship")), ...common401, 403: error("Não é administrador"), 404: error("Não encontrada"), ...common422 }
      }
    },
    "/admin/scholarships/{id}/reports": {
      get: { tags: ["Administração"], summary: "Relatos de erro da bolsa", security: session, parameters: [idParam], responses: { 200: ok("Relatos (mais recentes primeiro)", { type: "object" }), ...common401, 403: error("Não é administrador") } }
    },
    "/admin/scholarships/{id}/reports/resolve": {
      post: { tags: ["Administração"], summary: "Marcar relatos abertos como resolvidos", security: session, parameters: [idParam], responses: { 200: ok("Quantos foram resolvidos", { type: "object", properties: { resolved: { type: "integer" } } }), ...common401, 403: error("Não é administrador") } }
    },
    "/auth/register": {
      post: { tags: ["Contas"], summary: "Criar conta (inicia a sessão)", requestBody: json({ type: "object", required: ["name", "email", "password"], properties: { name: { type: "string", maxLength: 100 }, email: { type: "string", format: "email" }, password: { type: "string", minLength: 8, maxLength: 200 } } }), responses: { 201: ok("Conta criada; cookie de sessão posto", ref("UserResponse")), 409: error("E-mail já cadastrado (`email_taken`)"), ...common422, 429: error("Muitas tentativas") } }
    },
    "/auth/login": {
      post: { tags: ["Contas"], summary: "Entrar", requestBody: json({ type: "object", required: ["email", "password"], properties: strings("email", "password") }), responses: { 200: ok("Sessão iniciada", ref("UserResponse")), 401: error("E-mail ou senha incorretos (`invalid_credentials`)"), ...common422, 429: error("Muitas tentativas ou conta temporariamente bloqueada") } }
    },
    "/auth/logout": { post: { tags: ["Contas"], summary: "Sair", responses: { 204: noContent } } },
    "/auth/me": {
      get: { tags: ["Contas"], summary: "Estudante logado", security: session, responses: { 200: ok("Estudante", ref("UserResponse")), ...common401 } },
      delete: { tags: ["Contas"], summary: "Excluir a conta e todos os dados", security: session, requestBody: json({ type: "object", required: ["password"], properties: strings("password") }), responses: { 204: noContent, ...common401, 422: error("Senha ausente ou incorreta") } }
    },
    "/auth/me/export": {
      get: { tags: ["Contas"], summary: "Baixar todos os meus dados (JSON)", security: session, responses: { 200: ok("Arquivo JSON para download", { type: "object" }), ...common401 } }
    },
    "/auth/forgot-password": {
      post: { tags: ["Contas"], summary: "Pedir link de nova senha (sempre 204)", requestBody: json({ type: "object", required: ["email"], properties: strings("email") }), responses: { 204: noContent, ...common422, 429: error("Muitas tentativas") } }
    },
    "/auth/reset-password": {
      post: { tags: ["Contas"], summary: "Definir nova senha com o token do e-mail", requestBody: json({ type: "object", required: ["token", "password"], properties: strings("token", "password") }), responses: { 204: noContent, 400: error("Token inválido ou vencido (`invalid_token`)"), ...common422 } }
    },
    "/profile": {
      get: { tags: ["Perfil"], summary: "Perfil (campos vazios se nunca salvo)", security: session, responses: { 200: ok("Perfil", ref("Profile")), ...common401 } },
      put: { tags: ["Perfil"], summary: "Salvar perfil", security: session, requestBody: json(ref("ProfileInput")), responses: { 200: ok("Perfil salvo", ref("Profile")), ...common401, ...common422 } }
    },
    "/applications": {
      get: { tags: ["Candidaturas"], summary: "Minhas candidaturas", security: session, responses: { 200: ok("Lista", { type: "object", properties: { items: { type: "array", items: ref("Application") } } }), ...common401 } },
      post: { tags: ["Candidaturas"], summary: "Salvar bolsa (idempotente)", security: session, requestBody: json({ type: "object", required: ["scholarshipId"], properties: strings("scholarshipId") }), responses: { 200: ok("Já estava salva", ref("Application")), 201: ok("Criada", ref("Application")), ...common401, ...common422 } }
    },
    "/applications/{id}": {
      get: { tags: ["Candidaturas"], summary: "Detalhe", security: session, parameters: [idParam], responses: { 200: ok("Candidatura", ref("Application")), ...common401, 404: error("Não encontrada") } },
      patch: { tags: ["Candidaturas"], summary: "Atualização parcial (status, notas, documentos)", security: session, parameters: [idParam], requestBody: json(ref("ApplicationPatch")), responses: { 200: ok("Atualizada", ref("Application")), ...common401, 404: error("Não encontrada"), ...common422 } },
      delete: { tags: ["Candidaturas"], summary: "Remover (apaga checklist, notas, arquivos e linha do tempo)", security: session, parameters: [idParam], responses: { 204: noContent, ...common401, 404: error("Não encontrada") } }
    },
    "/applications/{id}/documents/{name}/file": {
      put: {
        tags: ["Candidaturas"],
        summary: "Anexar arquivo a um item do checklist (substitui)",
        security: session,
        parameters: [idParam, docParam],
        requestBody: { content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary", description: "PDF, JPG, PNG ou DOCX (verificado pelo conteúdo), até 10 MB" } } } } } },
        responses: { 200: ok("Arquivo guardado", ref("AttachedFile")), ...common401, 404: error("Item ou candidatura não encontrados"), 413: error("Acima de 10 MB"), 422: error("Tipo inválido, vazio ou sem o campo `file`") }
      },
      get: { tags: ["Candidaturas"], summary: "Baixar o arquivo", security: session, parameters: [idParam, docParam], responses: { 200: { description: "O arquivo (Content-Disposition: attachment)" }, ...common401, 404: error("Sem arquivo") } },
      delete: { tags: ["Candidaturas"], summary: "Remover o arquivo", security: session, parameters: [idParam, docParam], responses: { 204: noContent, ...common401, 404: error("Sem arquivo") } }
    },
    "/drafts": {
      get: { tags: ["Rascunhos"], summary: "Meus rascunhos (mais recente primeiro)", security: session, responses: { 200: ok("Lista", { type: "object", properties: { items: { type: "array", items: ref("Draft") } } }), ...common401 } },
      post: { tags: ["Rascunhos"], summary: "Criar rascunho", security: session, requestBody: json(ref("DraftInput")), responses: { 201: ok("Criado", ref("Draft")), ...common401, ...common422 } }
    },
    "/drafts/{id}": {
      get: { tags: ["Rascunhos"], summary: "Rascunho", security: session, parameters: [idParam], responses: { 200: ok("Rascunho", ref("Draft")), ...common401, 404: error("Não encontrado") } },
      put: { tags: ["Rascunhos"], summary: "Substituir rascunho", security: session, parameters: [idParam], requestBody: json(ref("DraftInput")), responses: { 200: ok("Salvo", ref("Draft")), ...common401, 404: error("Não encontrado"), ...common422 } },
      delete: { tags: ["Rascunhos"], summary: "Excluir rascunho", security: session, parameters: [idParam], responses: { 204: noContent, ...common401, 404: error("Não encontrado") } }
    }
  }
} as const;
