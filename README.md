# GlobalScholar — Frontend (ELEVATE)

Frontend em **Next.js 15 (App Router) + React 19 + TypeScript + CSS Modules**, com a linguagem visual ELEVATE:
preto e branco, serifa editorial (Playfair Display) + sans-serif (Inter), cartões escuros pontuais, fotografia no hero.
Idioma da interface: **português**. Nome de marca provisório: **GlobalScholar**.

## Como rodar

Requer **Node.js 20.9+** (recomendado 22).

```bash
npm install
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Frontend em http://localhost:3000 com **dados fictícios em memória** (nada é salvo). |
| `npm run dev:api` | Sobe **API local + frontend** juntos, em modo API real. Perfil e candidaturas ficam gravados em arquivo. |
| `npm run mock-api` | Só a API local, em http://localhost:4000/api. |
| `npm run mock-api:reset` | Apaga os dados gravados pela API local. |
| `npm run build` / `npm start` | Build e servidor de produção. |

## Qualidade

| Comando | O que verifica |
|---|---|
| `npm run typecheck` | Tipos (TypeScript estrito). |
| `npm run lint` | ESLint (falha com qualquer aviso). |
| `npm test` | Testes unitários, de componentes e da API local (Vitest + Testing Library). |
| `npm run test:coverage` | O mesmo, com relatório de cobertura em `coverage/index.html`. |
| `npm run test:e2e` | Ponta a ponta no navegador (Playwright). Primeira vez: `npx playwright install chromium`. |
| `npm run check` | Tipos + lint + testes + build: rode antes de abrir um PR. |

Os testes de ponta a ponta fazem um **build de produção em modo API real** (pasta `.next-e2e`) e sobem a API local na porta 4010
com um arquivo de dados próprio, zerado antes de cada teste. Eles cobrem: busca e filtros, detalhe e 404, salvar bolsa e persistência,
status e remoção de candidaturas, validação do perfil com foco, perfil → elegibilidade calculada pelo servidor, assistente,
e uma checagem de todas as telas em desktop e celular (sem erros no console e sem rolagem horizontal).

Cada push e pull request roda tudo isso no GitHub Actions (`.github/workflows/ci.yml`). Veja o [guia de Git](docs/git-guide.md).

## Modos de dados

| Modo | Como ativar | Dados |
|---|---|---|
| Demonstração | `npm run dev` (`.env.development` define `NEXT_PUBLIC_DATA_MODE=mock`) | Fictícios, em memória, com aviso visível na interface. |
| API local | `npm run dev:api` | Servidor `mock-api/` seguindo o contrato; grava em `mock-api/.data/db.json`. |
| API real | Build/produção (padrão) com `NEXT_PUBLIC_API_BASE_URL` | Backend do sócio. |

Se a API falhar, a interface mostra erro com "Tentar novamente". **Nunca** há troca silenciosa por dados fictícios.
Alterações em candidaturas aparecem na hora e são revertidas, com aviso, se o servidor recusar.

Para simular rede lenta ou instável com a API local (macOS/Linux):

```bash
MOCK_API_DELAY_MS=800 MOCK_API_FAIL_RATE=0.2 npm run mock-api
```

## Contrato com o backend

[`docs/api-contract.md`](docs/api-contract.md) descreve endpoints, campos, erros e as **decisões pendentes** (autenticação, níveis,
documentos, IA). A API local (`mock-api/server.mjs`) é a implementação de referência e tem testes próprios (`mock-api/server.test.mjs`).

## Deploy

Render: [`docs/deploy-render.md`](docs/deploy-render.md) e o blueprint [`render.yaml`](render.yaml) (frontend + API de demonstração).

## Estrutura

```
src/
  app/
    (marketing)/   landing (hero com foto + seção de recursos)
    (auth)/        login, register, forgot-password
    (student)/     dashboard, scholarships, scholarships/[id], eligibility/[scholarshipId],
                   applications, profile, assistant
  components/      ui (Button, ButtonLink, Field, Badge), feedback (Notice, EmptyState, ErrorState), layout
  features/        landing, auth, scholarships, applications, eligibility, profile, assistant
  lib/             config, constants, services (escolha mock/API), api (client, guards, serviços), validation, utils
  mocks/           dados e serviços de demonstração (data/scholarships.json é compartilhado com a API local)
  styles/          tokens.css, typography.css, patterns.module.css
  test/            setup e dublês de teste
  types/           contratos PROVISÓRIOS
mock-api/          API local (Node puro, sem dependências) + testes do contrato
e2e/               testes de ponta a ponta (Playwright)
docs/              contrato da API, guia de Git, deploy no Render
```

Fluxo: página → componente de feature → serviço (`lib/services.ts`) → cliente HTTP (`lib/api/client.ts`) → API.
Toda resposta da API passa por validação em tempo de execução (`lib/api/guards.ts`).

## O que é real e o que é demonstração

- **Funciona com a API (local ou real):** busca, detalhe, elegibilidade (calculada no servidor), perfil e candidaturas, com persistência.
- **Ainda demonstração:** autenticação (formulários só exibem aviso) e assistente de documentos (roteiro local, **sem IA**).
- **Nada é gravado no navegador** (sem `localStorage`).
- **Elegibilidade:** o frontend só exibe o resultado e os motivos; não calcula nem mostra probabilidades.
- "Enviada" em candidaturas é só o que o estudante marcou; a plataforma não envia candidaturas.

## Observações

- `public/images/hero-student-skyline.jpg` tem 768 px de largura; para telas grandes use uma versão em maior resolução
  (e confirme a licença de uso da imagem).
- Rotas de detalhe e elegibilidade não têm `loading.tsx` de propósito: assim uma bolsa inexistente devolve **HTTP 404** de verdade.
- Textos ainda estão nos componentes; a extração para dicionário (português/inglês) é a Fase 3.
