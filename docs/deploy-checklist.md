# Checklist de deploy (Render)

Use a cada publicação. O passo a passo da primeira configuração está em [deploy-render.md](./deploy-render.md).

## Antes de publicar

- [ ] O pull request está com o CI **verde** (tipos, lint, contraste, testes, build, orçamento de tamanho, ponta a ponta com axe).
- [ ] `CHANGELOG.md` atualizado com o que muda para o estudante.
- [ ] Se o contrato da API mudou: `docs/api-contract.md` atualizado e o backend avisado **antes** do deploy.
- [ ] Nenhum segredo no código. Lembrete: toda variável `NEXT_PUBLIC_*` vai para o navegador e é pública.
- [ ] Fotos novas em `public/images/` com licença confirmada.

## Variáveis de ambiente (serviço `globalscholar-web`)

| Variável | Valor | Observação |
|---|---|---|
| `NEXT_PUBLIC_DATA_MODE` | `api` | Nunca `mock` em produção. |
| `NEXT_PUBLIC_API_BASE_URL` | `https://<api>/api` | Entra no build e na Content Security Policy (`connect-src`). Mudou? *Clear build cache & deploy*. |
| `NEXT_PUBLIC_SITE_URL` | `https://<site>` | Sitemap, canonical, robots e imagens de compartilhamento. Sem barra no fim. |
| `NEXT_PUBLIC_UPLOADS_ENABLED` | vazio | Só `true` quando o backend implementar o envio de arquivos. |
| `NODE_VERSION` | `22` | |

Na API de demonstração (`globalscholar-api-demo`): `MOCK_API_ALLOW_RESET=0` e `CORS_ORIGIN` = URL exata do frontend.

## Depois de publicar (5 minutos)

- [ ] `https://<site>/` abre; trocar PT/EN funciona.
- [ ] `https://<site>/scholarships` lista bolsas (prova que a API responde e que a CSP libera a origem dela). Console do navegador sem erros.
- [ ] Abrir uma bolsa, salvar, ver em Candidaturas, recarregar: continua salva.
- [ ] `https://<site>/scholarships/nao-existe` responde **404** (aba Rede das ferramentas do navegador).
- [ ] `https://<site>/robots.txt` e `https://<site>/sitemap.xml` com o domínio certo (não `localhost`).
- [ ] Cabeçalhos: `curl -sI https://<site>/` mostra `content-security-policy`, `strict-transport-security`, `x-frame-options: DENY`.
- [ ] Pré-visualização do link: colar a URL num chat (WhatsApp/Slack) mostra título, descrição e a imagem da marca.
- [ ] Lighthouse na URL pública (`npm run lighthouse -- https://<site>`) sem queda grande em relação a `docs/lighthouse-report.md`.

## Se algo der errado

1. No Render: serviço → **Events** → deploy anterior → **Rollback**. Volta em cerca de 1 minuto, sem novo build.
2. Abra uma issue com o horário, a URL e o que aparece no console do navegador e em **Logs** do serviço.
3. Corrija num branch `fix/...`, com teste que reproduza o problema, e publique pelo fluxo normal.

## Antes do lançamento público (uma vez)

- [ ] Backend real no lugar da API de demonstração, com autenticação (decisão pendente 1 do contrato).
- [ ] Domínio próprio no Render (**Settings → Custom Domains**) e `NEXT_PUBLIC_SITE_URL` atualizado.
- [ ] Plano pago ou outro serviço sem "adormecer" (o gratuito leva ~1 min no primeiro acesso).
- [ ] Monitoramento de disponibilidade (ex.: um verificador externo chamando `/` e `/api/health` a cada 5 min).
- [ ] Páginas de privacidade e termos, e links no rodapé (hoje propositalmente ausentes).
- [ ] Testes manuais de acessibilidade listados em [accessibility.md](./accessibility.md).
- [ ] Fotos em alta resolução e logo definitivo no lugar do monograma provisório.
