/**
 * Especificação OpenAPI 3.1 da API (documentação interativa em /api/docs, JSON em /api/docs/json).
 * Mantida à mão junto com o docs/api-contract.md. Um teste (test/openapi.test.ts) garante que toda rota do
 * servidor está documentada aqui, e que nada documentado deixou de existir.
 */
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
    version: "1.1.0",
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
        required: ["id", "title", "institution", "country", "level", "fundingType", "funding", "deadline", "summary", "requirements", "requiredDocuments", "verification"],
        properties: {
          ...strings("id", "title", "institution", "country", "level", "fundingType", "funding", "summary", "applicationProcess", "deadlineTimezone"),
          deadline: { type: "string", format: "date" },
          requirements: { type: "array", items: { type: "string" } },
          requiredDocuments: { type: "array", items: { type: "string" } },
          eligibleCountries: { type: "array", items: { type: "string" } },
          sourceUrl: { type: "string", format: "uri" },
          verification: { type: "object", required: ["status"], properties: { status: { enum: ["verified", "unverified"] }, verifiedAt: { type: "string", format: "date" } } }
        }
      },
      ScholarshipPage: { type: "object", required: ["items", "total"], properties: { items: { type: "array", items: ref("Scholarship") }, total: { type: "integer" } } },
      EligibilityResult: {
        type: "object",
        required: ["scholarshipId", "status", "reasons"],
        properties: {
          scholarshipId: { type: "string" },
          status: { enum: ["eligible", "possible", "not_eligible"] },
          reasons: { type: "array", items: { type: "object", required: ["kind", "text"], properties: { kind: { enum: ["met", "missing", "failed"] }, text: { type: "string" } } } }
        }
      },
      ProfileInput: { type: "object", properties: strings("residence", "nationality", "level", "field", "grade", "languages", "interests"), required: ["residence", "level"] },
      Profile: { allOf: [ref("ProfileInput"), { type: "object", properties: { updatedAt: { type: "string", format: "date-time" } } }] },
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
      User: { type: "object", required: ["id", "email", "name"], properties: strings("id", "email", "name") },
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
