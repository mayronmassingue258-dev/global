# Registro de mudanças

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
