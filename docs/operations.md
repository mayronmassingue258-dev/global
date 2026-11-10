# Operação em produção

Guia para manter o GlobalScholar no ar: monitorar, fazer backup, restaurar, cadastrar bolsas reais e reagir a problemas.
Publicação passo a passo: [deploy-render.md](./deploy-render.md). Verificação a cada deploy: [deploy-checklist.md](./deploy-checklist.md).

## Visão geral

```
Navegador ──► globalscholar-web (Next.js)  ──/api/* repassado──►  globalscholar-api-demo (Fastify)  ──►  Supabase (PostgreSQL)
                 páginas, login (cookie)          com x-gs-internal nas          contas, dados, arquivos        tudo, inclusive anexos
                                                  chamadas do servidor
```

| Peça | Onde | Saúde |
|---|---|---|
| Site | `https://globalscholar-web.onrender.com` | `/` responde 200 |
| API | `https://globalscholar-api-demo.onrender.com` | `/api/health` → `{"ok":true}` (também testa a base) |
| Documentação da API | `https://globalscholar-api-demo.onrender.com/api/docs` | interativa (OpenAPI) |
| Base de dados | projeto no Supabase | painel do Supabase (Reports) |

## Monitoramento

1. **Render** já reinicia um serviço quando a verificação de saúde falha (`healthCheckPath` no `render.yaml`).
2. **Aviso quando cair** (gratuito): crie dois monitores HTTP de 5 em 5 minutos num serviço como UptimeRobot ou Better Stack,
   um para `https://globalscholar-web.onrender.com/` e outro para `https://globalscholar-api-demo.onrender.com/api/health`,
   com alerta por e-mail ou WhatsApp. Bônus: no plano gratuito do Render, esses acessos evitam que os serviços "durmam".
3. **Logs**: Render → serviço → **Logs**. Cada requisição da API tem um id (`reqId`), devolvido ao navegador no cabeçalho
   `x-request-id`: se um estudante relatar erro, peça esse código (ferramentas do navegador → Rede) e busque nos logs.
   Senhas, cookies e tokens nunca aparecem nos logs.

## Backups e restauração

**Plano gratuito do Supabase: sem backups para baixar.** Antes de ter estudantes reais:

1. Supabase → **Billing → Pro**: backups diários automáticos (e restauração a um ponto no tempo como opcional).
2. Backup manual (por exemplo, antes de uma migração grande), da sua máquina, com a URL do **Session pooler**
   (Supabase → Connect):

```bash
pg_dump --format=custom --no-owner --file=globalscholar-$(date +%F).dump "URL_EXTERNA_DA_BASE"
```

3. Restaurar num banco vazio (teste isso uma vez, antes de precisar):

```bash
pg_restore --no-owner --clean --if-exists --dbname="URL_DA_BASE_DE_DESTINO" globalscholar-AAAA-MM-DD.dump
```

> Use `pg_dump` da mesma versão principal do PostgreSQL do Supabase (veja em Settings → Infrastructure), ou mais nova.

**O que está na base:** contas (senhas só em hash), sessões, perfis, candidaturas, linha do tempo, **arquivos anexados** e rascunhos.
Os anexos ocupam espaço: acompanhe em Supabase → **Reports → Database** (500 MB no gratuito, 8 GB no Pro).

## Cadastrar bolsas reais

As bolsas de demonstração (`amostra-*`) são fictícias. Para trocar por bolsas reais:

1. Monte um arquivo JSON a partir de [`backend/scholarships.example.json`](../backend/scholarships.example.json): uma entrada por
   bolsa, com os dados copiados do **edital oficial**, `sourceUrl` apontando para ele e `verification.status: "verified"` só quando
   alguém conferiu (com `verifiedAt`). `criteria` alimenta o "o que falta no seu perfil".
2. Valide sem gravar (na sua máquina, com a URL externa da base em `backend/.env`):

```bash
npm --prefix backend run scholarships:import -- caminho/bolsas.json --dry-run
```

3. Grave (tudo ou nada). Na primeira vez, `--remove-demo` apaga as bolsas fictícias:

```bash
npm --prefix backend run scholarships:import -- caminho/bolsas.json --remove-demo
```

4. Em **globalscholar-api-demo → Environment**, mude `SEED_DEMO_DATA` para `0` (senão as fictícias voltam a cada reinício).

Atualizar uma bolsa = importar de novo com o mesmo `id`. Apagar uma bolsa apaga as candidaturas que estudantes salvaram nela:
prefira manter e deixar o prazo vencer.

## Segredos

| Segredo | Onde | Como trocar |
|---|---|---|
| `INTERNAL_API_SECRET` | gerado pelo Render na API; o site lê de lá | API → Environment → gerar novo valor; depois redeploy do site (*Clear build cache & deploy*). |
| `RESEND_API_KEY` | API → Environment | Criar nova chave no Resend, trocar aqui, apagar a antiga no Resend. |
| Senha da base | Supabase | Supabase → Settings → Database → *Reset database password*; depois atualize `DATABASE_URL` na API do Render. |

Nunca coloque segredos no código, no `render.yaml` ou em variáveis `NEXT_PUBLIC_*` (essas vão para o navegador).

## Quando algo der errado

| Sintoma | Primeiro passo |
|---|---|
| Site fora do ar | Render → globalscholar-web → **Events**: deploy com erro? **Rollback** para o anterior. |
| Páginas abrem, mas "Não foi possível carregar" | `…/api/health` da API. `503` = base fora: projeto pausado no Supabase? Reative no painel. |
| Ninguém consegue entrar | Logs da API. `CORS_ORIGIN`/`APP_URL` batem com o endereço do site? Cookie bloqueado = site sem o repasse `/api` (`API_INTERNAL_URL`). |
| Estudantes não recebem e-mail de nova senha | `EMAIL_PROVIDER=resend` e `RESEND_API_KEY` configurados? Domínio verificado no Resend? |
| Muitos `429` | Ataque ou um robô: veja os IPs nos logs. Os limites estão em `backend/src/app.ts`. |
| Migração falhou no deploy | A API não sobe (o `start:prod` migra antes). Rollback do deploy; corrija a migração num PR. A base não fica pela metade: cada migração roda numa transação. |

Depois de resolvido: registre o que aconteceu, a causa e o que evita a repetição (uma issue no GitHub serve).
