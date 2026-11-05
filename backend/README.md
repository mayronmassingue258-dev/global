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
| `ALLOW_TEST_RESET` | `0` | `1` só nos testes de ponta a ponta (`POST /api/__reset`). Proibido em produção (a API não inicia). |

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
  services/            consultas: bolsas, perfil, candidaturas (com linha do tempo), rascunhos
  db/schema.ts         tabelas (Drizzle) · db/migrate.ts · db/seed.ts · db/seed-data/ (bolsas fictícias)
drizzle/               migrações SQL versionadas (geradas a partir do schema)
test/                  testes de contrato com PostgreSQL real
```

### Base de dados

`users` · `scholarships` · `eligibility_criteria` · `profiles` · `applications` · `application_documents` ·
`application_events` (linha do tempo) · `drafts`. Toda informação do estudante tem `user_id`; apagar uma candidatura apaga
os documentos e eventos dela (chaves estrangeiras em cascata). Atualizações de candidatura rodam numa transação com a
linha travada (`FOR UPDATE`), então cliques simultâneos não corrompem a linha do tempo.

### Segurança já presente

Cabeçalhos de segurança (helmet), CORS restrito às origens configuradas, limite de 300 requisições/minuto por IP,
corpo de até 512 KB, busca protegida contra curingas `%`/`_`, `Cache-Control: no-store`, consultas parametrizadas (sem SQL montado
com texto do usuário), cookies e tokens apagados dos logs.

### Ainda não existe (próximas etapas)

- **B2 — Contas:** cadastro, login, sessão, recuperação de senha. Hoje todas as requisições usam um "estudante de demonstração" fixo.
- **B3 — Dados por estudante e anexos:** cada pessoa vê só os seus dados; armazenamento de arquivos.
- **B4 — Produção:** base paga com backups, documentação OpenAPI, monitoramento, cadastro de bolsas reais.
