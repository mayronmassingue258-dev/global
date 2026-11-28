# Registro de mudanças

## 3.4.1 — Consolidação: datas e carregamento das páginas (2026-11-28)

- **Páginas de bolsa, elegibilidade e candidatura podiam não abrir** ("Não foi possível carregar esta página"): o arquivo de
  JavaScript delas tinha colchetes e parênteses no nome (`app/(student)/scholarships/[id]/page-….js`), que alguns proxies e redes
  tratam de forma diferente (404). Agora esses caracteres viram `_` no nome dos arquivos (`next.config.ts`).
- **Bombas-relógio removidas:** as bolsas de demonstração têm prazo relativo a hoje (nunca vencem); perfis de teste com ano fixo
  passaram a usar o ano seguinte. Toda a bateria passa com o relógio em 2027 e em 2028.
- **"Próximos prazos" no painel** não mostra mais prazos já vencidos.
- Limites da busca automática (1 por dia, execução travada, rodízio semanal) usam só o relógio da base de dados.


## 3.4.0 — Busca sem admin e botão para o estudante (2026-11-27)

- **Corrigido:** a busca falhava com "models/gemini-flash-latest is not found for API version v1". Agora usa a API `v1beta`
  (necessária para pesquisa no Google e leitura de páginas) e **escolhe sozinha** o Flash estável mais recente disponível para a chave.
- **"Procurar novas bolsas para mim"** em "Para você": busca na web guiada pelo perfil, sem depender de admin; acompanha o andamento
  e recarrega as recomendações ao terminar. Limites: 1 por estudante por dia e um total diário.
- **Busca semanal automática**: roda o rodízio quando alguém usa o site e a última busca tem mais de 7 dias.
- Painel: "11 fontes · 0 novas" no histórico (antes aparecia "110 novas").


## 3.3.0 — Busca de bolsas pelo painel, rodando no Render (2026-11-26)

- **Painel /admin → "Busca automática de bolsas"**: escolher fontes (rodízio da semana, todas ou uma), fazer um **ensaio** ou
  **buscar e publicar**. A busca roda em segundo plano dentro da API (no Render, sem serviço extra); o painel acompanha o andamento
  e guarda o histórico com resumo e registro (tabela `discovery_runs`, migração `0005`). Uma execução por vez.
- Chave do Gemini no **Environment** do Render (`GEMINI_API_KEY`); sem ela, o painel explica o que falta.
- API: `GET /admin/discovery`, `POST /admin/discovery/runs` (202), `GET /admin/discovery/runs/{id}`.
- O agendamento pelo GitHub Actions continua como opção.


## 3.2.0 — Busca de bolsas com o Gemini (gratuito) (2026-11-26)

- A busca automática passa a usar a **API do Gemini** por padrão (nível gratuito, segredo `GEMINI_API_KEY`). Duas chamadas por fonte:
  pesquisa com Google Search + leitura das páginas (URL context), depois conversão para o JSON da plataforma com esquema.
- O Claude continua disponível (`DISCOVERY_PROVIDER=claude`). Teto de chamadas por execução (`--max-requests`, padrão 40),
  pausa entre chamadas e nova tentativa quando o limite gratuito do Google é atingido (429).
- Os filtros de publicação não mudaram (link oficial, prazo aberto, país lusófono, validação completa); no Gemini eles são a
  garantia de "só sites oficiais", já que a pesquisa não pode ser restrita a domínios.


## 3.1.0 — R2: busca automática de bolsas reais (2026-11-25)

- **Busca de bolsas nas fontes oficiais com o Claude** (`backend/src/discovery/`, `npm --prefix backend run discovery`): 22 fontes
  (governos, universidades e fundações) relevantes para estudantes lusófonos. Pesquisa e leitura restritas aos domínios oficiais de
  cada fonte (`web_search`/`web_fetch` com `allowed_domains`), resposta em JSON estruturado.
- **Filtros antes de publicar:** link oficial, prazo exato e aberto, aceita país lusófono, validação do importador. Publica como
  "não verificada"; nunca altera bolsas verificadas, cadastradas à mão ou ocultadas por um admin.
- **Teto de gasto por execução**, modo **ensaio** (`--dry-run`), escolha de fontes (`--only`, `--all`).
- **GitHub Actions** ("Bolsas: busca automática"): toda segunda-feira, metade das fontes em rodízio; manual quando quiser.
  Precisa dos segredos `ANTHROPIC_API_KEY` e `DATABASE_URL` (ver `docs/operations.md`).


## 3.0.3 — Telas que "não carregavam" (2026-11-24)

- No plano gratuito do Render, a API dorme depois de ~15 min sem uso. Enquanto ela acorda, o **próprio Render** recusa os pedidos
  do servidor do site com `429` e `x-render-routing: hibernate-rate-limited`, sem que cheguem à API. As telas mostravam
  "Não foi possível carregar". Agora o repasse `/api` e as chamadas feitas ao montar as páginas **esperam a API acordar** e
  repetem o pedido (até ~45 s; seguro mesmo em gravações, porque o pedido não tinha chegado). Erros da própria API não são repetidos.
- Teste de teclado do assistente esperava a tela carregar antes de navegar (falhava às vezes).


## 3.0.2 — Conta bloqueada explicada (2026-11-24)

- Depois de 10 senhas erradas para o mesmo e-mail, o login dele fica bloqueado por 15 minutos (proteção contra adivinhação).
  Antes, a tela dizia só "Muitas tentativas. Aguarde um minuto"; agora explica o bloqueio e indica **"Esqueci a senha"**
  (código `account_locked` na API, separado do limite por visitante `rate_limited`).
- **Definir uma senha nova pelo link do e-mail desbloqueia a conta na hora.**


## 3.0.1 — Login que "não passava" (2026-11-21)

### Corrigido
- **Limite de tentativas de login dividido por todos os estudantes.** O navegador fala com `/api` do site, que repassa ao
  backend; o backend via só o IP do servidor do site, então as 10 tentativas por minuto valiam para **todo mundo junto** e o login
  falhava com poucos acessos simultâneos. Agora o repasse é uma rota do Next (`src/app/api/[...path]/route.ts`) que informa o IP do
  visitante em `x-gs-client-ip`, aceito pelo backend **só** junto com a chave interna; pedidos diretos usam o `cf-connecting-ip`
  do Cloudflare. O `X-Forwarded-For` (que qualquer um pode forjar) deixou de contar.
- **Envio antes de o site carregar.** Com o servidor "acordando" ou rede lenta, quem clicava em Entrar antes de o JavaScript
  carregar fazia o navegador enviar o formulário sozinho: a página recarregava (com a senha no endereço). Os formulários de
  login, cadastro, nova senha e exclusão de conta agora usam `method="post"` e o botão só fica ativo com a página pronta.
- Backend fora do ar ou lento demais aparece como `502 backend_unreachable` / `504 backend_timeout`, no envelope de erro.


## 3.0.0 — R1: perfil completo e bolsas para cada estudante (2026-11-18)

### Novo
- **Perfil em 6 etapas** (Origem, Formação, Idiomas, Experiência, Objetivos, Finanças), salvo a cada passo, com barra de
  "perfil X% completo". Nacionalidades (até 3), país onde mora, nota em qualquer escala (0–20, 0–4, 0–10…, com vírgula decimal),
  idiomas com nível, testes (IELTS, TOEFL…), anos de experiência, níveis desejados, destinos preferidos e excluídos, modalidade,
  ano de início e situação financeira. Países com nome em PT ou EN; tudo guardado em códigos estáveis.
- **Motor de compatibilidade** no backend (`backend/src/matching/`): elimina o que o estudante não pode aceitar (nacionalidade,
  nível, formação concluída, idade, experiência, público restrito, modalidade, destino excluído, bolsa sem propinas e sustento para
  quem precisa de integral, prazo vencido) e dá uma **nota de 0 a 100** com os porquês ("Inglês: pede C1; você indicou B2").
- **"Para você"** (`/recommendations`, no menu e no painel): as 10 bolsas mais compatíveis, explicadas, com link para o edital e "Salvar".
- **Página da bolsa**: "Quem pode se candidatar" (níveis, nacionalidades e grupos como CPLP, cobertura, idiomas, testes, nota mínima,
  idade, taxa), nota de compatibilidade, avisos de bolsa fictícia / não verificada / fora do ar, e **"Reportar erro"**.
- **Publicação automática com proteções**: bolsas novas entram como "não verificadas"; 3 relatos graves de estudantes diferentes
  (link quebrado, encerrada, golpe) tiram a bolsa do ar; bolsas com prazo vencido saem sozinhas (na partida e a cada 6 horas).
- **Painel de administração** (`/admin`, só para `role: admin`): todas as bolsas (reportadas primeiro), verificar, ocultar/reativar,
  ver e resolver relatos, criar e editar bolsas em JSON. Dar acesso: `npm --prefix backend run admin:grant -- email`.

### Mudou (incompatível)
- Contrato da API **2.0**: perfil estruturado, `Scholarship.match/status/origin`, elegibilidade com `score`, `fit` e motivos em código
  (o site escreve as frases em PT/EN). Migração `0004_r1_matching`: perfis antigos (texto livre) viram vazios, exceto os objetivos;
  bolsas que não são de demonstração ficam ocultas até serem reimportadas com critérios.
- Importador: cada bolsa precisa de `match` (ver `backend/scholarships.example.json`); `eligibleCountries` e `criteria` saíram.
- **Removida a API de demonstração `mock-api/`** (`npm run dev:api`): o backend real a substitui (`npm run dev:full`).
  `npm run dev` continua com dados fictícios em memória, sem servidor.
- Orçamento de JavaScript por página: 150 → 160 KB (dicionários PT e EN maiores; motivo em `scripts/check-bundle-size.mjs`).

### Testes
98 no backend, 245 no frontend (inclui um teste que confere o vocabulário do frontend com o do backend e que todo motivo tem
frase em PT e EN), ponta a ponta com o perfil em etapas, recomendações, reportar erro e axe nas telas novas.


## 2.4.0 — Base de dados no Supabase (2026-11-10)

- A base de dados passa a ser o **Supabase**; o `render.yaml` não cria mais uma base no Render (`DATABASE_URL` vem do painel).
- **Row Level Security ligado em todas as tabelas** (migração `0003_enable_rls`): a API automática do Supabase (chave `anon`) não lê
  nada. Verificado com um usuário comum dono das tabelas (como no Supabase): o backend funciona e o papel `anon` vê 0 linhas.
- Suporte ao pooler do Supabase: SSL (`DATABASE_SSL=require`) e `DATABASE_PREPARE=0` para o modo *Transaction*.
- Guia passo a passo em `docs/deploy-render.md` ("Base de dados no Supabase"); operação e backups atualizados.

## 2.3.0 — Backend B4: pronto para produção (2026-11-10)

### Novo
- **Documentação interativa da API** em `/api/docs` (OpenAPI 3.1), com teste que garante que toda rota está documentada.
- **Importador de bolsas reais** (`npm --prefix backend run scholarships:import -- arquivo.json`): valida o arquivo inteiro com
  mensagens por item e campo, grava tudo ou nada, atualiza pelo `id` e pode remover as bolsas fictícias (`--remove-demo`).
  Modelo em `backend/scholarships.example.json`.
- **`x-request-id`** em cada resposta da API, para localizar nos logs a requisição de um erro relatado.
- **`docs/operations.md`**: monitoramento, backups e restauração (comandos prontos), cadastro de bolsas reais, troca de segredos e
  o que fazer quando algo falha. **`docs/deploy-checklist.md`** reescrito para site + API + base de dados, com o checklist de lançamento.

### Testes
69 no backend, 234 no frontend, 96 de ponta a ponta.

## 2.2.0 — Backend B3: anexos e privacidade (2026-11-09)

### Novo
- **Anexos de verdade** em cada item do checklist da candidatura: o arquivo sobe assim que é escolhido, fica guardado (PostgreSQL),
  pode ser baixado e removido. Até 10 MB; o servidor confere o tipo **pelo conteúdo** (um executável renomeado para .pdf é recusado).
- **Página Conta** (`/account`, pelo nome no cabeçalho): dados da conta, **baixar meus dados** (JSON com perfil, candidaturas e
  rascunhos) e **excluir a conta** com a senha, apagando tudo em cascata.

### Corrigido
- **Limite de requisições** (o CI da 2.1.0 falhou nos testes de ponta a ponta por isso): era por IP, e as páginas renderizadas pelo
  servidor do site chamam o backend sempre do mesmo IP. Agora conta por sessão (logado) ou IP (visitante), o servidor do site se
  identifica com uma chave interna, e há **bloqueio por conta** após 10 senhas erradas (vale mesmo se o atacante trocar de IP).
- Cobertura de testes do frontend voltou acima do mínimo (funções 92,9%); `npm run check` agora mede a cobertura como o CI.

### Testes
62 no backend, 234 no frontend, 96 de ponta a ponta. Um arquivo de 9 MB foi enviado pelo site e baixado idêntico.

## 2.1.0 — Backend B2: contas (2026-11-09)

### Novo
- **Contas de verdade**: cadastro, login, sair, "esqueci a senha" (link por e-mail, válido por 1 hora e uso único) e nova senha
  (página `/reset-password`). O cabeçalho mostra o nome do estudante e "Sair"; a landing oferece "Ir para o painel" a quem já entrou.
- **Cada estudante vê só os seus dados**: perfil, candidaturas, rascunhos e elegibilidade passam a ser da conta logada.
- **Áreas privadas protegidas**: sem login, painel, candidaturas, perfil, assistente e elegibilidade levam ao login e voltam depois.
  Visitantes continuam vendo a busca e o detalhe das bolsas; "Salvar" leva ao login.
- **Segurança**: senhas com scrypt; sessão em cookie HttpOnly/SameSite=Lax/Secure, com só o hash do token na base; mesma resposta
  para e-mail inexistente e senha errada; bloqueio de alterações vindas de outros sites (CSRF); limite de 10 tentativas/minuto nas
  rotas de conta; redefinir a senha encerra todas as sessões; `?next=` só aceita caminhos internos.
- **Arquitetura**: o site repassa `/api/*` ao backend (`API_INTERNAL_URL`), tornando o cookie de login de primeira parte
  (funciona no Safari/iPhone). A Content Security Policy ficou mais restrita (`connect-src 'self'`).
- **Envio de e-mail**: `EMAIL_PROVIDER=log` (link no log, para desenvolver) ou `resend` (produção).
- **Testes**: 48 no backend (20 novos de contas e isolamento), 212 no frontend, **90 de ponta a ponta** (8 novos de contas).

### Precisa de ação no Render
Aplicar o *Sync* do blueprint (ver `docs/deploy-render.md`, "Atualização: contas"). Para os estudantes receberem o e-mail de nova senha,
configurar o Resend.

## 2.0.0 — Backend B1: API real com PostgreSQL (2026-11-05)

### Novo
- **`backend/`**: API em Node.js + TypeScript + Fastify com **PostgreSQL** (Drizzle ORM), implementando todo o contrato atual:
  bolsas (busca, filtros, paginação estável), elegibilidade calculada a partir do perfil, perfil, candidaturas com checklist,
  notas e linha do tempo (em transação), e rascunhos.
- **Base de dados** com 8 tabelas, chaves estrangeiras em cascata, restrições de valores e **migrações SQL versionadas**.
- **Testes**: 27 testes do backend contra PostgreSQL real (inclui os testes de contrato) e os **82 testes de ponta a ponta do
  frontend agora rodam contra o backend real**. O CI ganhou um job de backend com PostgreSQL e verifica que nenhuma migração ficou sem gerar.
- **Desenvolvimento local**: `docker-compose.yml` (PostgreSQL) e `npm run dev:full` (backend + site).
- **Render**: o blueprint cria a base `globalscholar-db` e o serviço `globalscholar-api-demo` passa a rodar o backend real.

### Ainda não
- Contas e login (B2). Até lá, todas as requisições usam um "estudante de demonstração".

## 1.5.2 — Senha (2026-11-05)

- Campo de senha (login e cadastro) sempre oculto por padrão, com botão de olho para mostrar/ocultar quando a pessoa quiser.
  A senha volta a ficar oculta ao enviar o formulário; com ela visível, corretor e maiúscula automática ficam desligados.
  Funciona pelo teclado e é anunciado por leitores de tela ("Mostrar senha, pressionado").

## 1.5.1 — Fotos (2026-11-04)

- Fotos do mosaico do projeto em uso: prédio curvo em "Como funciona", campus ao pôr do sol no fechamento da landing,
  biblioteca no assistente (`public/images/`).
- Fechamento da landing em duas colunas (texto + foto), em vez de foto de fundo atrás do texto: contraste garantido e a foto
  aparece num tamanho compatível com o arquivo. Foto do assistente em coluna quadrada mais estreita.
- As fotos foram recortadas de um mosaico (≈300–380 px de largura): substituir pelos originais deixa tudo mais nítido, sem mudar código.

## 1.5.0 — Fase 4: qualidade de produção (2026-11-02)

### Novo
- **Acessibilidade automática**: axe-core (WCAG 2.2 A/AA) em 14 telas × 2 idiomas e 5 estados difíceis; teste de **navegação só com
  teclado** com verificação de foco visível; `npm run contrast` mede os pares de cor da paleta. Tudo no CI. Ver `docs/accessibility.md`.
- **Performance**: orçamento de JS/CSS por página (`npm run size`, no CI), Lighthouse documentado (`npm run lighthouse`,
  `docs/lighthouse-report.md`): 95–100 em performance e 100 em acessibilidade, boas práticas e SEO.
- **Segurança**: Content Security Policy, HSTS, `X-Frame-Options`, `nosniff`, `Permissions-Policy`, sem `X-Powered-By`.
- **Entrega**: README final, `docs/deploy-checklist.md` (Render) e guia do Render atualizado.

### Corrigido
- Contraste do verde dos selos (4,44:1 → 5,42:1).
- Seletor de idioma: nome acessível não continha o texto visível (comando de voz).
- Ordem de títulos na busca (h1 → h3).
- `<meta name="description">` era transmitida depois do `</head>` (Next 15): pré-visualizações de links e Lighthouse não a viam.
- Foto do hero sem `fetchpriority=high` (landing no celular: Lighthouse 84 → 95).
- `/register` estava no sitemap e marcado como não indexável ao mesmo tempo.
- Versões duplicadas do `playwright-core` (axe e Playwright) alinhadas.

### Como testar esta entrega

```bash
npx playwright install chromium
```

```bash
npm run check
```

```bash
npm run test:e2e
```

Depois, siga `docs/deploy-render.md` para publicar e `docs/deploy-checklist.md` para conferir.

## 1.4.0 — Fase 3: funcionalidade (2026-11-02)

### Novo
- **Busca compartilhável**: filtros na URL (`/scholarships?q=…&level=…&country=…&sort=title`), chips de filtros ativos com remoção
  individual, "Limpar tudo" e "Copiar link desta busca". Escolher um filtro cria entrada no histórico (voltar desfaz); digitar não.
- **Formulários**: perfil e rascunhos do assistente recuperam edições não salvas (sessionStorage da aba, com "Descartar") e pedem
  confirmação ao fechar a aba com alterações pendentes. Login e cadastro agora validam com mensagens por campo e foco no primeiro erro.
- **Upload de documentos**: "Anexar arquivo" em cada item do checklist, com validação de tipo e tamanho e função de envio pronta
  para o contrato proposto. Envio real desligado até o backend definir (`NEXT_PUBLIC_UPLOADS_ENABLED`).
- **Dois idiomas**: português (padrão) e inglês, com seletor no cabeçalho, no rodapé, na landing e nas telas de login.
  Todos os textos em dicionário (`src/i18n`), inclusive orientações do assistente, datas e plurais.
- **SEO**: `robots.txt`, `sitemap.xml` dinâmico, canonical, Open Graph por bolsa e dados estruturados (schema.org `MonetaryGrant`).
- **Contrato 0.4**: proposta de envio de arquivos e de idioma dos dados.

### Como testar esta entrega

```bash
npm run dev:api
```

1. **Bolsas**: digite "Mestrado", escolha "Título (A–Z)". Copie o link e abra em outra aba: a busca é a mesma. Use "voltar" do navegador.
2. Clique em **EN** no cabeçalho: tudo muda para inglês e continua assim ao navegar. Volte para **PT**.
3. **Perfil**: digite algo sem salvar, vá para Bolsas e volte: o texto está lá, com o aviso e o botão "Descartar".
4. **Candidaturas → Abrir → Anexar arquivo**: tente um `.exe` (recusado) e um PDF (aceito, com aviso de envio desligado).
5. Abra http://localhost:3000/robots.txt e http://localhost:3000/sitemap.xml.

## 1.3.0 — Fase 2: visual mais premium (2026-11-02)

### Novo
- **Fotografia com `next/image`** (AVIF/WebP, tamanhos responsivos). Espaços prontos para `building.jpg`, `library.jpg` e `campus.jpg`:
  basta colocar os arquivos em `public/images/` (veja o README dessa pasta). Sem eles, aparece um painel editorial no lugar.
- **Landing**: a grade de blocos deu lugar a uma seção editorial "Como funciona" (foto + quatro passos numerados) e a um fechamento com foto de campus.
- **Detalhe da bolsa**: aside fixo com o prazo em destaque ("Faltam 31 dias"), resumo, ação de salvar e o checklist
  **"O que falta no seu perfil"**, vindo da avaliação do servidor.
- **Assistente** virou um espaço de documento: rascunhos salvos (lista + URL `?draft=`), estrutura de seções por tipo
  (carta de motivação, currículo acadêmico, declaração pessoal, revisão), orientação por seção, contagem de palavras com faixa
  de referência, salvamento automático e "copiar documento". Continua **sem IA**.
- **Detalhe da candidatura** (`/applications/{id}`): checklist de documentos com progresso, notas com salvamento automático,
  linha do tempo, status, prazo e atalho para escrever um documento para aquela bolsa.
- **Polimento**: esqueletos de carregamento, estados vazios com ícone, selo de prazo próximo nos cartões, microinterações discretas
  (respeitam "reduzir movimento").
- **Marca provisória**: favicon e ícone Apple com monograma "G", imagem de compartilhamento (Open Graph/Twitter) com o nome de trabalho.
- **Contrato 0.3**: candidatura com `documents`, `notes`, `timeline`; `GET /applications/{id}`; `PATCH` parcial; `/drafts`.
  A API local implementa tudo e converte dados gravados na versão anterior.

### Corrigido
- Caixas de seleção e cartões de rádio personalizados: o desenho ficava por cima do controle nativo e bloqueava o clique direto.
- "Doutorado" quebrava no meio da palavra no resumo da bolsa.

### Como testar esta entrega

```bash
npm run dev:api
```

1. Página inicial: role até "Como funciona" e o fechamento.
2. **Bolsas → Programa de Doutorado…**: veja o prazo em destaque e "O que falta no seu perfil". Preencha nota e idiomas no perfil e volte: as pendências somem.
3. Salve a bolsa → **Candidaturas → Abrir**: marque documentos, escreva notas, mude o status; recarregue e veja a linha do tempo.
4. "Escrever um documento para esta bolsa" → crie uma carta, escreva em duas seções, recarregue: o texto continua lá.
5. Para ver os esqueletos de carregamento, deixe a API lenta: crie `.env.development.local` com `NEXT_PUBLIC_DATA_MODE=api` e `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api`, rode `MOCK_API_DELAY_MS=1500 npm run mock-api` em um terminal e `npm run dev` em outro.

## 1.2.0 — Fase 1: base sólida (2026-11-02)

### Novo
- **API local** (`npm run mock-api`, `npm run dev:api`): servidor Node sem dependências que segue o contrato e grava perfil e
  candidaturas em `mock-api/.data/db.json`. A elegibilidade é calculada no servidor a partir do perfil salvo.
- **Perfil e candidaturas ligados a serviços** (demonstração em memória ou API). Candidaturas atualizam na hora e são revertidas,
  com aviso, se o servidor recusar.
- **Formulário de perfil** carrega o perfil salvo, valida no cliente e no servidor (422) e leva o foco ao primeiro campo com erro.
- **Testes**: 107 testes unitários, de componentes e do contrato da API local (Vitest, ~90% de cobertura; mínimo exigido 80%)
  e 31 testes de ponta a ponta (Playwright, desktop e celular).
- **CI no GitHub Actions**: tipos, lint, testes com cobertura, build e ponta a ponta a cada push/PR. Dependabot e modelo de PR.
- **Documentos**: `docs/api-contract.md` (para o backend), `docs/git-guide.md`, `docs/deploy-render.md` + `render.yaml`.

### Corrigido
- **O build de produção falhava**: o painel era pré-gerado no build e chamava a API, que não existe nessa hora. Agora é dinâmico
  e mostra um erro amigável se a API não responder.
- **Bolsa inexistente devolvia HTTP 200** (por causa do `loading.tsx` do grupo). Agora devolve **404**.
- **Página de elegibilidade sem título `<h1>`** (acessibilidade). Agora tem.
- Botões "Salvar" de uma lista tinham todos o mesmo nome para leitores de tela; agora incluem o título da bolsa.
- Aviso do autoprefixer (`align-items: end` em flexbox).

### Como testar esta entrega

```bash
npm install
npx playwright install chromium
npm run check
npm run test:e2e
npm run dev:api
```

Com `npm run dev:api` aberto em http://localhost:3000:

1. **Bolsas** → salve duas bolsas → recarregue a página: continuam salvas.
2. **Candidaturas** → mude o status de uma → recarregue: o status ficou.
3. **Perfil** → clique em *Salvar perfil* vazio: o foco vai para "País de residência".
4. Preencha *Moçambique* + *Mestrado* e salve. Abra `/eligibility/amostra-004`: **Não elegível** (país fora da lista).
   Troque o país para *Suíça*: **Elegível**.
5. Pare tudo (Ctrl+C), rode `npm run dev:api` de novo: perfil e candidaturas continuam lá.
6. `npm run mock-api:reset` apaga tudo.
