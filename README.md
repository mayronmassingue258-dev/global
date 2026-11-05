# GlobalScholar — Frontend

Plataforma para estudantes descobrirem bolsas de estudo, entenderem o que cada uma exige e organizarem suas candidaturas.
**Next.js 15 (App Router) + React 19 + TypeScript + CSS Modules**, linguagem visual ELEVATE (preto e branco, Playfair Display + Inter,
fotografia editorial). Interface em **português** (principal) e **inglês**. Nome de marca provisório: **GlobalScholar**.

| | |
|---|---|
| Qualidade | testes unitários/componentes e de ponta a ponta (fluxos, axe em 14 telas × 2 idiomas, teclado, segurança) rodando no CI · cobertura ~94% |
| Lighthouse | Performance 95–100 · Acessibilidade 100 · Boas práticas 100 · SEO 100 ([relatório](docs/lighthouse-report.md)) |
| Backend | [`backend/`](backend/README.md): Node.js + TypeScript + Fastify + PostgreSQL (Drizzle), implementando o contrato da API |
| Deploy | Render, via [`render.yaml`](render.yaml): frontend + API + PostgreSQL ([guia](docs/deploy-render.md) · [checklist](docs/deploy-checklist.md)) |

## Começar

Requer **Node.js 20.9+** (recomendado 22).

```bash
npm install
```

```bash
npm run dev:api
```

Abre http://localhost:3000 com a **API local** (http://localhost:4000/api): perfil, candidaturas e rascunhos ficam gravados em
`mock-api/.data/db.json`. Para só olhar o visual, sem servidor: `npm run dev` (dados fictícios em memória).

### Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Frontend com dados fictícios em memória (aviso visível na tela). |
| `npm run dev:full` | **Backend real + PostgreSQL** + frontend (ver [`backend/README.md`](backend/README.md); requer Docker). |
| `npm run dev:api` | API de demonstração (sem base de dados) + frontend em modo API. |
| `npm run mock-api` / `mock-api:reset` | Só a API local / apagar os dados dela. |
| `npm run build` / `npm start` | Build e servidor de produção. |
| `npm run check` | Tipos + lint + contraste + testes + build + orçamento de tamanho. **Rode antes de abrir um PR.** |
| `npm test` / `test:watch` / `test:coverage` | Testes unitários, de componentes e do contrato da API local (Vitest). |
| `npm run test:e2e` | Ponta a ponta no navegador (Playwright). Primeira vez: `npx playwright install chromium`. |
| `npm run contrast` | Contraste WCAG dos pares de cor da paleta. |
| `npm run size` | Orçamento de JS/CSS por página (depois do build). |
| `npm run lighthouse -- <url>` | Lighthouse em celular e desktop; gera `docs/lighthouse-report.md`. |

## Modos de dados

| Modo | Como ativar | Dados |
|---|---|---|
| Demonstração | `npm run dev` (`.env.development` define `NEXT_PUBLIC_DATA_MODE=mock`) | Fictícios, em memória, com aviso na interface. |
| API de demonstração | `npm run dev:api` | `mock-api/`, seguindo o contrato; grava em arquivo, sem base de dados. |
| Backend real | `npm run dev:full` / produção + `NEXT_PUBLIC_API_BASE_URL` | `backend/` com PostgreSQL. |

Se a API falhar, a interface mostra o erro com "Tentar novamente". **Nunca** troca silenciosamente por dados fictícios.
Variáveis: veja [`.env.example`](.env.example).

## O que o produto faz hoje

- **Busca** com filtros na URL (link compartilhável, "voltar" funciona), chips de filtros ativos, paginação.
- **Detalhe da bolsa** com prazo em destaque, "o que falta no seu perfil" (avaliação feita **pelo servidor**), requisitos, documentos e fonte.
- **Perfil acadêmico** com validação, foco no primeiro erro e recuperação do que foi digitado.
- **Candidaturas**: lista com progresso e prazos; detalhe com checklist de documentos, anexar arquivo (validação; envio desligado),
  notas com salvamento automático e linha do tempo.
- **Assistente de documentos**: carta de motivação, currículo, declaração pessoal e revisão, com estrutura por seções, orientação,
  contagem de palavras, salvamento automático e rascunhos. **Sem IA**: quem escreve é o estudante.
- **Dois idiomas**, SEO (sitemap, robots, Open Graph, schema.org), marca provisória (favicon, imagem de compartilhamento).

### O que ainda é demonstração

- **Autenticação**: formulários validam, mas não criam sessão (aguarda decisão 1 do contrato).
- **Envio de arquivos**: desligado (`NEXT_PUBLIC_UPLOADS_ENABLED`) até o backend definir o armazenamento.
- **Contas**: o backend ainda usa um único "estudante de demonstração" (as contas chegam na etapa B2).
- "Enviada" em candidaturas é só uma marcação do estudante; a plataforma não envia nada aos provedores.

## Documentação

| Documento | Para quê |
|---|---|
| [`docs/api-contract.md`](docs/api-contract.md) | Contrato com o backend: endpoints, campos, erros e **decisões pendentes**. Para o seu sócio. |
| [`docs/git-guide.md`](docs/git-guide.md) | GitHub, branches, PRs e como ler o CI. |
| [`docs/deploy-render.md`](docs/deploy-render.md) · [`docs/deploy-checklist.md`](docs/deploy-checklist.md) | Primeira publicação e verificação a cada deploy. |
| [`docs/accessibility.md`](docs/accessibility.md) | O que é testado, contraste medido, correções e testes manuais pendentes. |
| [`docs/performance.md`](docs/performance.md) · [`docs/lighthouse-report.md`](docs/lighthouse-report.md) | Orçamento de tamanho, imagens e Lighthouse. |
| [`public/images/README.md`](public/images/README.md) | Quais fotos faltam e como adicioná-las. |
| [`CHANGELOG.md`](CHANGELOG.md) | O que mudou em cada fase, com roteiro de teste. |

## Arquitetura

```
src/
  app/            rotas: (marketing) landing · (auth) login/cadastro · (student) painel, bolsas, elegibilidade,
                  candidaturas, perfil, assistente · robots, sitemap, ícones e imagem de compartilhamento
  components/     ui (botões, campos, selos, prazo), feedback (avisos, estados, esqueletos), media (Photo), layout
  features/       landing, auth, scholarships, applications, eligibility, profile, assistant
  i18n/           dicionários pt/en, provider, seletor, leitura do idioma no servidor
  lib/            config, services (mock ou API), api (cliente HTTP, validação das respostas, serviços), validation,
                  searchParams, formDrafts, uploads, seo, securityHeaders, utils
  mocks/          dados e serviços de demonstração (data/scholarships.json é compartilhado com a API local)
  styles/         tokens (cores, espaçamentos), tipografia, padrões
  types/          tipos do contrato (provisório)
backend/          API real: Fastify + PostgreSQL (Drizzle), migrações, testes de contrato (ver backend/README.md)
mock-api/         API de demonstração em Node puro, sem dependências nem base de dados
e2e/              Playwright: fluxos, acessibilidade (axe), teclado, idiomas, segurança
scripts/          dev-api, contraste, orçamento de tamanho, Lighthouse
docs/             documentação acima
```

Fluxo de dados: página → componente de feature → serviço (`lib/services.ts`) → cliente HTTP (`lib/api/client.ts`) → API.
Toda resposta da API é validada em tempo de execução (`lib/api/guards.ts`) antes de chegar à tela.

### Decisões que vale conhecer

- **Idioma por cookie** (`gs_locale`), mesmas URLs. Simples, mas só o português é indexado; para indexar o inglês, migrar para `/en/...`.
  Textos em `src/i18n/dictionaries/pt.ts` (fonte da verdade) e `en.ts`; um teste garante que as chaves são idênticas.
- **No navegador** ficam apenas o cookie de idioma e cópias temporárias de formulários não salvos no `sessionStorage` da aba
  (apagadas ao salvar, descartar ou fechar a aba). Nada vai para o `localStorage`; senhas nunca são guardadas.
- **Elegibilidade** é sempre calculada pelo backend; o frontend só apresenta, sem probabilidades.
- **404 real**: rotas de detalhe não têm `loading.tsx` e os metadados são resolvidos antes de a página ser transmitida.
- **Segurança**: Content Security Policy (libera só a origem da API), HSTS, `X-Frame-Options: DENY`, `nosniff`, sem `X-Powered-By`
  (`src/lib/securityHeaders.ts`).

## Pendências fora do frontend

1. Respostas do backend às decisões do contrato (autenticação, níveis, idioma dos dados, arquivos, IA).
2. Fotos `building.jpg`, `library.jpg`, `campus.jpg` e hero em alta resolução, com licença confirmada.
3. Logo definitivo, páginas de privacidade/termos, domínio próprio.
