# Operação em produção

Guia para manter o GlobalScholar no ar: monitorar, fazer backup, restaurar, cadastrar bolsas reais e reagir a problemas.
Publicação passo a passo: [deploy-render.md](./deploy-render.md). Verificação a cada deploy: [deploy-checklist.md](./deploy-checklist.md).

## Visão geral

```
Navegador ──► globalscholar-web (Next.js)  ──/api/* repassado──►  globalscholar-api-demo (Fastify)  ──►  globalscholar-db (PostgreSQL)
                 páginas, login (cookie)          com x-gs-internal nas          contas, dados, arquivos        tudo, inclusive anexos
                                                  chamadas do servidor
```

| Peça | Onde | Saúde |
|---|---|---|
| Site | `https://globalscholar-web.onrender.com` | `/` responde 200 |
| API | `https://globalscholar-api-demo.onrender.com` | `/api/health` → `{"ok":true}` (também testa a base) |
| Documentação da API | `https://globalscholar-api-demo.onrender.com/api/docs` | interativa (OpenAPI) |
| Base de dados | `globalscholar-db` no Render | painel do Render |

## Monitoramento

1. **Render** já reinicia um serviço quando a verificação de saúde falha (`healthCheckPath` no `render.yaml`).
2. **Aviso quando cair** (gratuito): crie dois monitores HTTP de 5 em 5 minutos num serviço como UptimeRobot ou Better Stack,
   um para `https://globalscholar-web.onrender.com/` e outro para `https://globalscholar-api-demo.onrender.com/api/health`,
   com alerta por e-mail ou WhatsApp. Bônus: no plano gratuito do Render, esses acessos evitam que os serviços "durmam".
3. **Logs**: Render → serviço → **Logs**. Cada requisição da API tem um id (`reqId`), devolvido ao navegador no cabeçalho
   `x-request-id`: se um estudante relatar erro, peça esse código (ferramentas do navegador → Rede) e busque nos logs.
   Senhas, cookies e tokens nunca aparecem nos logs.

## Backups e restauração

**Plano gratuito da base: sem backups, e a base é apagada 30 dias após a criação.** Antes de ter estudantes reais:

1. Render → **globalscholar-db → Settings → Plan → Basic** (≈ 6 USD/mês): backups diários automáticos, restauração a um ponto no tempo
   (conforme o plano) e a base não expira.
2. Backup manual extra (por exemplo, antes de uma migração grande), da sua máquina, com a **External Database URL** do painel
   (Render → globalscholar-db → Connections):

```bash
pg_dump --format=custom --no-owner --file=globalscholar-$(date +%F).dump "URL_EXTERNA_DA_BASE"
```

3. Restaurar num banco vazio (teste isso uma vez, antes de precisar):

```bash
pg_restore --no-owner --clean --if-exists --dbname="URL_DA_BASE_DE_DESTINO" globalscholar-AAAA-MM-DD.dump
```

> Para usar a URL externa, a base precisa aceitar o seu IP: Render → globalscholar-db → **Access Control**. O `render.yaml`
> começa sem nenhum IP liberado (só os serviços do Render acessam). Libere o seu IP só durante o backup e remova depois.

**O que está na base:** contas (senhas só em hash), sessões, perfis, candidaturas, linha do tempo, **arquivos anexados** e rascunhos.
Os anexos ocupam espaço: acompanhe em globalscholar-db → **Metrics** (o plano Basic tem 1 GB; aumente quando passar de 70%).

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
| Senha da base | gerenciada pelo Render | Render → globalscholar-db → *Rotate password* (a API recebe a nova URL automaticamente). |

Nunca coloque segredos no código, no `render.yaml` ou em variáveis `NEXT_PUBLIC_*` (essas vão para o navegador).

## Quando algo der errado

| Sintoma | Primeiro passo |
|---|---|
| Site fora do ar | Render → globalscholar-web → **Events**: deploy com erro? **Rollback** para o anterior. |
| Páginas abrem, mas "Não foi possível carregar" | `…/api/health` da API. `503` = base fora; Render → globalscholar-db. |
| Ninguém consegue entrar | Logs da API. `CORS_ORIGIN`/`APP_URL` batem com o endereço do site? Cookie bloqueado = site sem o repasse `/api` (`API_INTERNAL_URL`). |
| Estudantes não recebem e-mail de nova senha | `EMAIL_PROVIDER=resend` e `RESEND_API_KEY` configurados? Domínio verificado no Resend? |
| Muitos `429` | Ataque ou um robô: veja os IPs nos logs. Os limites estão em `backend/src/app.ts`. |
| Migração falhou no deploy | A API não sobe (o `start:prod` migra antes). Rollback do deploy; corrija a migração num PR. A base não fica pela metade: cada migração roda numa transação. |

Depois de resolvido: registre o que aconteceu, a causa e o que evita a repetição (uma issue no GitHub serve).
