# Contrato da API — GlobalScholar (PROVISÓRIO)

> **Versão 0.3 · 2026-11-02 · Status: aguardando confirmação do backend.**
> Este documento descreve o que o **frontend espera hoje**. Nada aqui está decidido até o backend confirmar.
> Para cada item, responda **OK**, **mudar para…** ou **não vamos ter**. Mudanças entram por pull request neste arquivo.

A implementação de referência deste contrato é o servidor local `mock-api/server.mjs` (rode `npm run mock-api`).
Os testes automáticos em `mock-api/server.test.mjs` verificam cada regra abaixo; se o contrato mudar, eles mudam junto.

---

## 1. Convenções gerais

| Tema | Esperado pelo frontend |
|---|---|
| Base | `NEXT_PUBLIC_API_BASE_URL`, ex.: `https://api.exemplo.com/api`. Todos os caminhos abaixo são relativos a ela. |
| Formato | JSON em UTF-8. Requisições com corpo enviam `Content-Type: application/json`. Todas enviam `Accept: application/json`. |
| Nomes de campos | `camelCase`. |
| Datas | Prazo de bolsa: `AAAA-MM-DD` (data sem hora). Carimbos de tempo: ISO 8601 em UTC, ex.: `2026-11-02T18:57:54.737Z`. |
| IDs | Texto opaco (`string`). O frontend nunca interpreta nem gera IDs; ele os codifica na URL com `encodeURIComponent`. |
| Textos | Em português. Textos longos podem conter quebras de linha `\n`, sem HTML. |
| Cache | Respostas de dados do usuário devem vir com `Cache-Control: no-store`. |
| CORS | Se a API ficar em outro domínio, liberar a origem do frontend e os métodos `GET, POST, PUT, PATCH, DELETE, OPTIONS`, cabeçalhos `Accept, Content-Type`. |
| Chamadas do servidor | O Next.js também chama a API a partir do servidor (renderização das páginas de detalhe, painel e elegibilidade). A API precisa estar acessível pelo servidor do frontend, não só pelo navegador. |

## 2. Erros

Toda resposta de erro (`4xx`/`5xx`) usa o mesmo envelope:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Texto para desenvolvedores (não é mostrado ao usuário).",
    "fields": { "residence": "required" }
  }
}
```

- `code` (obrigatório): identificador estável em `snake_case`. A interface escolhe o texto pelo **código**.
- `message` (opcional): livre, para logs. **O frontend nunca exibe** essa mensagem.
- `fields` (opcional): mapa `campo → código do erro do campo`, só em erros de validação.

| Status | `code` | Quando | O que o frontend faz |
|---|---|---|---|
| 400 | `invalid_query` | Parâmetros de busca inválidos | Mensagem genérica |
| 400 | `invalid_json` / `invalid_body` | Corpo não é JSON / não é objeto | Mensagem genérica |
| 401 | `unauthenticated` | Sem sessão ou sessão expirada | "Sua sessão expirou. Entre novamente." |
| 403 | `forbidden` | Sem permissão | "Você não tem permissão…" |
| 404 | `not_found` | Recurso inexistente | Bolsa → página 404. Remover candidatura → tratado como sucesso. |
| 409 | `conflict` | (reservado) | "Este registro já existe." |
| 413 | `payload_too_large` | Corpo grande demais | Mensagem genérica |
| 422 | `validation_failed` | Validação de campos | Marca cada campo de `fields` e coloca o foco no primeiro |
| 429 | `rate_limited` | Muitas requisições | "Aguarde um instante…" |
| 5xx | `internal_error` etc. | Falha do servidor | "Tente novamente em instantes" + botão **Tentar novamente** |

**Códigos de erro de campo** usados hoje: `required`, `too_long`, `invalid_type`, `invalid_option`, `out_of_range`, `not_found`.

Se a resposta não tiver o formato esperado (inclusive sucesso com JSON diferente do descrito aqui), o frontend trata como erro
`502 unexpected_response` e **não** mostra dados parciais nem troca por dados fictícios.

---

## 3. Bolsas

### Objeto `Scholarship`

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | string | sim | |
| `title` | string | sim | Pode ser longo; a interface quebra linhas. |
| `institution` | string | sim | |
| `country` | string | sim | País de destino, por extenso. |
| `level` | string | sim | Um de: `Graduação`, `Mestrado`, `Doutorado`, `Curso livre`. **A confirmar:** lista fechada ou códigos (`bachelor`…)? |
| `fundingType` | string | sim | Rótulo curto: `Integral`, `Parcial`, `Auxílio mensal`… A interface colore `Integral` e `Parcial`. |
| `funding` | string | sim | Descrição da cobertura. |
| `deadline` | string | sim | `AAAA-MM-DD`. |
| `deadlineTimezone` | string | não | Ex.: `GMT`, `America/Toronto`. Se ausente, a interface avisa "fuso não informado". |
| `summary` | string | sim | |
| `requirements` | string[] | sim | Pode ser vazio. |
| `requiredDocuments` | string[] | sim | Pode ser vazio. |
| `applicationProcess` | string | não | |
| `eligibleCountries` | string[] | não | Países de residência aceitos. Ausente = sem restrição conhecida. |
| `sourceUrl` | string | não | URL `https://` do provedor oficial. |
| `verification.status` | `"verified"` \| `"unverified"` | sim | |
| `verification.verifiedAt` | string | não | `AAAA-MM-DD`; só com `verified`. |

### `GET /scholarships`

Parâmetros (todos opcionais; o frontend não envia os vazios):

| Parâmetro | Tipo | Padrão | Regra |
|---|---|---|---|
| `search` | string | — | Busca em título, instituição e país, sem diferenciar maiúsculas. |
| `country` | string | — | País de destino (contém). |
| `level` | string | — | Igual a um dos níveis. |
| `sort` | `deadline` \| `title` | `deadline` | Prazo mais próximo primeiro / título A–Z. |
| `page` | inteiro ≥ 1 | 1 | |
| `pageSize` | inteiro 1–50 | 10 | |

Resposta `200`:

```json
{ "items": [ { "id": "amostra-001", "title": "…", "…": "…" } ], "total": 6 }
```

`total` é o total de resultados do filtro (não da página). Parâmetro inválido → `400 invalid_query` com `fields`.

### `GET /scholarships/{id}`

`200` com um `Scholarship`, ou `404 not_found`.

### `GET /scholarships/{id}/eligibility`

Avaliação do **estudante atual** para a bolsa, calculada **pelo backend** com base no perfil salvo.
O frontend não calcula elegibilidade nem mostra probabilidade.

```json
{
  "scholarshipId": "amostra-004",
  "status": "possible",
  "reasons": [
    { "kind": "met", "text": "Nível de estudo compatível com o programa." },
    { "kind": "missing", "text": "Falta informar: país de residência." }
  ]
}
```

| Campo | Valores |
|---|---|
| `status` | `eligible` (todos os critérios conhecidos atendidos) · `possible` (faltam informações) · `not_eligible` (algum requisito obrigatório não atendido) |
| `reasons[].kind` | `met` · `missing` · `failed` |
| `reasons[].text` | Frase pronta para exibir, em português. |

`404 not_found` se a bolsa não existir. **A confirmar:** quando não há avaliação possível, devolver `404` ou `200` com `reasons` vazio?

---

## 4. Perfil acadêmico

### Objeto `Profile`

Todos os campos são texto; vazio (`""`) significa "não informado". O backend devolve **sempre** todos os campos.

| Campo | Obrigatório ao salvar | Máx. | Observação |
|---|---|---|---|
| `residence` | sim | 80 | País de residência. |
| `nationality` | não | 80 | |
| `level` | sim | 40 | Nível de estudo atual (mesma lista de `Scholarship.level`). |
| `field` | não | 120 | Área de estudo. |
| `grade` | não | 60 | Resultado acadêmico com a escala, texto livre ("16 em 20"). |
| `languages` | não | 200 | Texto livre ("Inglês B2"). |
| `interests` | não | 1000 | |
| `updatedAt` | — | — | Só na resposta. ISO 8601. |

O backend deve remover espaços nas pontas (`trim`) antes de validar e salvar.

### `GET /profile`

`200` com o `Profile` (todos os campos vazios se o estudante ainda não salvou nada — **não** `404`).

### `PUT /profile`

Corpo: todos os campos do perfil (sem `updatedAt`). Substitui o perfil inteiro.
Resposta `200` com o `Profile` salvo. Erros: `422 validation_failed` com `fields`, ex.: `{ "residence": "required", "interests": "too_long" }`.

---

## 5. Candidaturas acompanhadas

"Candidatura" aqui é **o acompanhamento do estudante**. A plataforma **não envia** nada ao provedor da bolsa; o status é só o que o estudante marcou.

### Objeto `Application`

| Campo | Tipo | Observação |
|---|---|---|
| `id` | string | Hoje é igual ao `id` da bolsa (uma candidatura por bolsa). **A confirmar** se o backend terá ID próprio. |
| `scholarship` | `{ id, title, institution, deadline }` | Resumo da bolsa, para listar sem buscar cada uma. |
| `status` | string | `Saved`, `Preparing`, `Ready to submit`, `Submitted`, `Decision received`. |
| `documents` | `{ name: string, done: boolean }[]` | Checklist criado a partir de `requiredDocuments` da bolsa no momento em que foi salva. `name` identifica o item. |
| `notes` | string | Notas livres do estudante (máx. 5000). Vazio = sem notas. |
| `timeline` | `TimelineEvent[]` | Histórico em ordem cronológica (mais antigo primeiro), registrado **pelo servidor**. |
| `updatedAt` | string | ISO 8601. |

`TimelineEvent` (sempre com `at`, ISO 8601):

| `kind` | Campos extras | Quando |
|---|---|---|
| `created` | — | Bolsa salva. |
| `status` | `status` | Status mudou. |
| `document` | `document` (nome), `done` | Item do checklist marcado/desmarcado. |
| `notes` | — | Notas mudaram. Edições seguidas em até **10 minutos** atualizam o `at` do último evento `notes` em vez de criar outro. |

### `GET /applications`

`200` → `{ "items": [Application, …] }`. Ordem livre (o frontend ordena por prazo).

### `GET /applications/{id}`

`200` + `Application`, ou `404 not_found`.

### `POST /applications`

Corpo: `{ "scholarshipId": "amostra-001" }`.
- `201` + `Application` criada (status `Saved`, checklist com todos os documentos `done: false`, evento `created`).
- `200` + `Application` existente, se já estava salva (**idempotente**: clicar duas vezes não duplica).
- `422 validation_failed` com `fields.scholarshipId` = `required` ou `not_found`.

### `PATCH /applications/{id}`

Atualização **parcial**: envie só o que mudou. Pelo menos um campo é obrigatório.

```json
{ "status": "Preparing", "documents": [{ "name": "Diploma", "done": true }], "notes": "Pedir carta à professora Ana." }
```

- `documents` contém só os itens alterados, identificados por `name`; nomes desconhecidos são ignorados.
- Só mudanças reais geram eventos na linha do tempo (enviar o mesmo status não cria evento).
- `200` + `Application` atualizada. `404` se não existir. `422` com `fields`: `status: invalid_option`, `notes: too_long | invalid_type`,
  `documents: invalid_type`, ou `status: required` se o corpo vier vazio.

### `DELETE /applications/{id}`

`204` sem corpo. `404` se não existir (o frontend trata como já removida).

---

## 6. Rascunhos do assistente de documentos

O assistente **não usa IA** nesta versão: o frontend oferece a estrutura de seções por tipo de documento e o estudante escreve.
O backend só guarda os rascunhos. As seções de cada tipo são definidas no frontend (`src/features/assistant/templates.ts`).

### Objeto `Draft`

| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | Gerado pelo servidor. |
| `type` | string | `motivation_letter`, `academic_cv`, `personal_statement`, `document_review`. |
| `title` | string | Obrigatório, máx. 120 (com `trim`). |
| `program` | string | Opcional, máx. 160. |
| `sections` | objeto `chave → texto` | Até 20 chaves no formato `^[a-z][a-z0-9_]{0,39}$`; cada texto com máx. 20 000 caracteres. |
| `createdAt`, `updatedAt` | string | ISO 8601. |

### Rotas

| Método e caminho | Corpo | Resposta |
|---|---|---|
| `GET /drafts` | — | `200 { "items": [Draft] }`, mais recente primeiro |
| `POST /drafts` | `{ type, title, program, sections }` | `201` + `Draft` |
| `GET /drafts/{id}` | — | `200` + `Draft` ou `404` |
| `PUT /drafts/{id}` | `{ type, title, program, sections }` (substitui tudo) | `200` + `Draft` ou `404` |
| `DELETE /drafts/{id}` | — | `204` ou `404` |

Validação: `422 validation_failed` com `fields` (`type: invalid_option`, `title: required | too_long`, `program: too_long`, `sections: invalid_type | too_long`).
O frontend salva automaticamente cerca de 1 segundo após o estudante parar de digitar, então espere `PUT` frequentes.

---

## 7. Decisões pendentes (precisamos da sua resposta)

1. **Autenticação.** Cookie de sessão `HttpOnly` (recomendado para Next.js, exige `credentials: "include"` e CORS com origem fixa) ou token `Bearer`? Quais rotas: `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/forgot-password`, `GET /auth/me`?
2. **Níveis de estudo.** Texto em português (como hoje) ou códigos estáveis (`bachelor`, `master`…) que o frontend traduz? Códigos facilitam o inglês da Fase 3.
3. **Paginação.** `page`/`pageSize` + `total` atende? Ou cursor?
4. **Idioma dos dados.** Bolsas e motivos de elegibilidade virão em mais de um idioma (`Accept-Language`)?
5. **ID de candidatura** próprio ou igual ao da bolsa?
6. **Documentos (Fase 3).** Upload direto para a API (`multipart/form-data`) ou URL pré-assinada para armazenamento (S3 e afins)? Tipos e tamanho máximo aceitos?
7. **Assistente de IA.** Endpoint futuro (ex.: `POST /drafts/{id}/suggestions`) com resposta em streaming? A chave da IA fica **só** no backend.
8. **Limites.** Haverá limite de requisições (`429`) e com qual cabeçalho (`Retry-After`)?
9. **Versão.** Prefixo `/v1` na URL?

## 8. Fora do contrato

- `POST /__reset` existe só no servidor local para os testes automáticos. Não implementar no backend real.
- `mock-api/criteria.json` são regras fictícias para o servidor local calcular elegibilidade; o backend real terá as suas.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.3 | 2026-11-02 | Candidatura com `documents`, `notes` e `timeline`; `GET /applications/{id}`; `PATCH` parcial; rascunhos (`/drafts`). |
| 0.2 | 2026-11-02 | Envelope de erro, perfil, candidaturas, validação da busca, elegibilidade baseada no perfil. |
| 0.1 | — | Caminhos iniciais de bolsas e elegibilidade (só no código). |
