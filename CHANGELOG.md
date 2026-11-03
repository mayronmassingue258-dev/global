# Registro de mudanças

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
