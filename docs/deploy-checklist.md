# Checklist de deploy (Render)

Use a cada publicação. Primeira configuração: [deploy-render.md](./deploy-render.md). Dia a dia em produção: [operations.md](./operations.md).

## Antes de publicar

- [ ] O CI do pull request está **verde** nos três jobs: frontend (tipos, lint, contraste, testes com cobertura, build, tamanho),
      backend (tipos, testes com PostgreSQL, build, migrações em dia) e ponta a ponta (site + backend + PostgreSQL, com axe).
- [ ] Mudou o esquema da base? A migração gerada (`npm --prefix backend run db:generate`) está no PR e foi lida.
      Migração que apaga coluna/tabela: faça um backup manual antes (ver operations.md).
- [ ] Mudou o contrato da API? `docs/api-contract.md` e `backend/src/openapi.ts` atualizados (um teste confere as rotas).
- [ ] `CHANGELOG.md` atualizado.
- [ ] Nenhum segredo no código. Variáveis `NEXT_PUBLIC_*` vão para o navegador: nunca segredos nelas.

## Variáveis de ambiente

**globalscholar-web** (site):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `api` |
| `NEXT_PUBLIC_API_BASE_URL` | `/api` (o site repassa ao backend) |
| `API_INTERNAL_URL` | endereço do backend, sem `/api` (ex.: `https://globalscholar-api-demo.onrender.com`) |
| `INTERNAL_API_SECRET` | lido do serviço da API (automático no `render.yaml`) |
| `NEXT_PUBLIC_SITE_URL` | endereço público do site, sem barra no fim |
| `NEXT_PUBLIC_UPLOADS_ENABLED` | `true` |

**globalscholar-api-demo** (API):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | da base `globalscholar-db` (automático) |
| `NODE_ENV` | `production` (cookie `Secure`; proíbe rotas de teste) |
| `CORS_ORIGIN` / `APP_URL` | endereço exato do site |
| `INTERNAL_API_SECRET` | gerado pelo Render |
| `EMAIL_PROVIDER` / `RESEND_API_KEY` / `EMAIL_FROM` | `resend` + chave (secret) + remetente do domínio verificado |
| `SEED_DEMO_DATA` | `1` só enquanto não houver bolsas reais; depois `0` |

Variáveis do site são lidas no **build**: depois de mudar, *Manual Deploy → Clear build cache & deploy*.

## Depois de publicar (10 minutos)

- [ ] `…api-demo.onrender.com/api/health` → `{"ok":true}`; `…/api/docs` abre a documentação.
- [ ] Site abre; PT/EN funciona; **Bolsas** lista resultados; console do navegador sem erros.
- [ ] Criar uma conta de teste → painel; sair; entrar de novo.
- [ ] "Esqueci a senha" com essa conta: o e-mail chega (ou o link aparece nos Logs, se `EMAIL_PROVIDER=log`).
- [ ] Salvar uma bolsa, anexar um PDF, recarregar, baixar o PDF.
- [ ] Em outro navegador (ou aba anônima), outra conta **não** vê nada da primeira.
- [ ] **Conta → Baixar meus dados** gera o JSON; **Excluir conta** apaga a conta de teste.
- [ ] `…/scholarships/nao-existe` responde **404**; `/robots.txt` e `/sitemap.xml` com o domínio certo.
- [ ] `curl -sI https://<site>/` mostra `content-security-policy`, `strict-transport-security`, `x-frame-options: DENY`.

## Se algo der errado

Render → serviço → **Events** → deploy anterior → **Rollback** (cerca de 1 minuto). Mais em [operations.md](./operations.md).

## Antes do lançamento público (uma vez)

- [ ] **Base paga** (Basic) com backups; restauração testada uma vez.
- [ ] **E-mail real** (Resend com domínio verificado).
- [ ] **Bolsas reais** importadas e `SEED_DEMO_DATA=0` (ver operations.md).
- [ ] **Serviços pagos** ou outro plano sem "adormecer" (o gratuito leva ~1 minuto no primeiro acesso).
- [ ] **Monitoramento** do site e de `/api/health` com alerta.
- [ ] **Domínio próprio** (Render → Settings → Custom Domains) e as variáveis `NEXT_PUBLIC_SITE_URL`, `APP_URL`, `CORS_ORIGIN` atualizadas.
- [ ] **Privacidade e termos**: páginas escritas (o site guarda dados pessoais e documentos) e links no rodapé.
- [ ] Testes manuais de acessibilidade ([accessibility.md](./accessibility.md)).
- [ ] Fotos em alta resolução e logo definitivo.
