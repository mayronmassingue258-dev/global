# GlobalScholar — API (backend)

**Node.js + TypeScript + Fastify + PostgreSQL (Drizzle ORM).** Implementa o contrato em [`../docs/api-contract.md`](../docs/api-contract.md).

## Rodar na sua máquina

Pré-requisitos: Node.js 20.12+ e Docker (para o PostgreSQL).

```bash
docker compose up -d
```

```bash
cp backend/.env.example backend/.env
```

```bash
npm --prefix backend install
```

```bash
npm run dev:full
```

Isso aplica as migrações, cria as bolsas de demonstração e sobe a **API em http://localhost:4000/api** e o **site em http://localhost:3000**
(ambos recarregam ao salvar). Sem Docker, use `npm run dev:api` na raiz (API de demonstração, sem base de dados).

## Comandos (dentro de `backend/`)

| Comando | O que faz |
|---|---|
| `npm run dev` | API com recarga automática (lê `backend/.env`). |
| `npm test` | Testes contra um PostgreSQL de teste (`TEST_DATABASE_URL`; padrão `postgres://postgres@127.0.0.1:5433/globalscholar_test`). |
| `npm run typecheck` / `npm run build` | Tipos / compilação para `dist/`. |
| `npm run db:generate` | Depois de mudar `src/db/schema.ts`: gera a migração SQL em `drizzle/`. **Versione o arquivo gerado.** |
| `npm run db:migrate` | Aplica migrações pendentes. |
| `npm run db:seed` | Insere/atualiza as bolsas fictícias de demonstração. |
| `npm run start:prod` | Produção: migra e inicia (usado pelo Render). |
| `npm run scholarships:import -- arquivo.json [--dry-run] [--remove-demo]` | Importa bolsas reais (modelo: `scholarships.example.json`; ver `docs/operations.md`). |

Para os testes, crie a base de teste uma vez (com o docker-compose):

```bash
docker compose exec db createdb -U globalscholar globalscholar_test
```

```bash
TEST_DATABASE_URL=postgres://globalscholar:globalscholar@localhost:5432/globalscholar_test npm --prefix backend test
```

## Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | — (obrigatória) | Conexão PostgreSQL. |
| `PORT` / `HOST` | `4000` / `0.0.0.0` | Onde a API escuta. |
| `CORS_ORIGIN` | vazio | Origens do frontend autorizadas, separadas por vírgula. |
| `SEED_DEMO_DATA` | `1` | Cria as bolsas fictícias ao iniciar. `0` quando houver bolsas reais. |
| `DATABASE_SSL` | `disable` | `require` para conexões externas que exigem SSL. |
| `LOG_LEVEL` | `info` | `silent` nos testes. |
| `APP_URL` | `http://localhost:3000` | Endereço do site, usado nos links dos e-mails (nova senha). |
| `SESSION_DAYS` | `30` | Duração da sessão (renovada com o uso). |
| `SESSION_COOKIE_SECURE` | ligado em produção | Cookie só por HTTPS. |
| `EMAIL_PROVIDER` | `log` | `log`: o e-mail aparece no terminal/log. `resend`: envia de verdade (exige `RESEND_API_KEY`). |
| `RESEND_API_KEY` / `EMAIL_FROM` | — / `GlobalScholar <onboarding@resend.dev>` | Envio pelo Resend. |
| `INTERNAL_API_SECRET` | — | Segredo compartilhado com o servidor do site (cabeçalho `x-gs-internal`): suas chamadas não contam no limite por IP. |
| `ALLOW_TEST_RESET` | `0` | `1` só nos testes de ponta a ponta (`POST /api/__reset`, `GET /api/__emails`). Proibido em produção (a API não inicia). |

A configuração é validada na partida: valor errado = mensagem clara e a API não sobe.

## Arquitetura

```
src/
  server.ts            ponto de entrada (lê .env, conecta, semeia, escuta)
  app.ts               aplicação Fastify: segurança, erros no envelope do contrato, rotas /api/*
  config.ts            variáveis de ambiente validadas (zod)
  lib/validation.ts    validações com os códigos de erro do contrato
  lib/errors.ts        HttpError e envelope { error: { code, message, fields? } }
  eligibility/         motor de elegibilidade (regras explicáveis, sem probabilidades)
  auth/                senhas (scrypt), tokens, envio de e-mail
  services/            bolsas, perfil, candidaturas (com linha do tempo), rascunhos, contas, arquivos, exportação/exclusão
  db/schema.ts         tabelas (Drizzle) · db/migrate.ts · db/seed.ts · db/seed-data/ (bolsas fictícias)
drizzle/               migrações SQL versionadas (geradas a partir do schema)
test/                  testes de contrato com PostgreSQL real
```

### Documentação da API

Interativa em **`/api/docs`** (JSON OpenAPI em `/api/docs/json`), a partir de `src/openapi.ts`. O teste `test/openapi.test.ts`
falha se uma rota existir sem documentação, ou o contrário.

### Base de dados

`users` · `sessions` · `password_resets` · `scholarships` · `eligibility_criteria` · `profiles` · `applications` · `application_documents` ·
`application_events` (linha do tempo) · `document_files` · `drafts`. Toda informação do estudante tem `user_id`; apagar uma candidatura apaga
os documentos e eventos dela (chaves estrangeiras em cascata). Atualizações de candidatura rodam numa transação com a
linha travada (`FOR UPDATE`), então cliques simultâneos não corrompem a linha do tempo.

### Contas

Cadastro, login, logout, "esqueci a senha" e redefinição (`src/services/auth.ts`, rotas `/api/auth/*`).
Senhas com **scrypt** (sal aleatório, comparação em tempo constante); sessão em **cookie HttpOnly** com token aleatório de 256 bits,
do qual a base guarda só o hash; sessões vencidas são apagadas a cada 6 horas. Login errado tem a mesma resposta (e tempo parecido)
para e-mail inexistente e senha errada. Redefinir a senha encerra todas as sessões da conta. Toda consulta de dados do estudante é
filtrada pelo id da sessão: um estudante nunca vê nem altera dados de outro (há testes para isso).

### Anexos e privacidade

Arquivos do checklist em `document_files` (PostgreSQL, até 10 MB, tipo verificado pelo conteúdo), download com `Content-Disposition:
attachment` e `sandbox`. O estudante pode **baixar todos os seus dados** (`GET /api/auth/me/export`) e **excluir a conta**
(`DELETE /api/auth/me`, com a senha), o que apaga tudo em cascata.

### Segurança já presente

Cabeçalhos de segurança (helmet), CORS restrito às origens configuradas, bloqueio de alterações vindas de outros sites (CSRF:
cookie `SameSite=Lax` + verificação de `Origin`), limite de 10 tentativas/minuto nas rotas de conta e bloqueio por conta após 10 senhas erradas, limite global por sessão/IP, limite de 300 requisições/minuto por IP,
corpo de até 512 KB, busca protegida contra curingas `%`/`_`, `Cache-Control: no-store`, consultas parametrizadas (sem SQL montado
com texto do usuário), cookies e tokens apagados dos logs.

### Para produção

Monitoramento, backups, restauração e cadastro de bolsas reais: [`docs/operations.md`](../docs/operations.md).
