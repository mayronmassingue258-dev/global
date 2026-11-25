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
   alguém conferiu (com `verifiedAt`). O bloco **`match`** (critérios) é o que decide para quem a bolsa é recomendada: níveis,
   nacionalidades (códigos ISO como `MZ`, ou grupos `@CPLP`, `@AFRICA`, `@COMMONWEALTH`), áreas, o que cobre, idiomas, testes,
   nota mínima em %, idade máxima, experiência. Critério errado = bolsa recomendada para quem não pode se candidatar: confira com cuidado.
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

## Busca automática de bolsas (R2)

O Claude pesquisa e lê **só os sites oficiais** das fontes em `backend/src/discovery/sources.ts` (Chevening, Commonwealth, DAAD,
Erasmus Mundus, Gulbenkian, Camões, PEC-G/PEC-PG, Stipendium Hungaricum, Türkiye Bursları, MEXT, China, Coreia, Suécia, Mastercard
Foundation, Fulbright, Australia Awards, Aga Khan, Gates Cambridge, Itália, Banco Mundial, AfDB, Nova Zelândia) e devolve as bolsas
no formato da plataforma. Uma bolsa só entra no ar se:

- o link do edital é do site oficial da fonte (https);
- tem prazo exato, entre 3 dias e 2 anos a partir de hoje;
- aceita pelo menos um país lusófono (ou qualquer nacionalidade);
- passa na mesma validação do importador.

Entra como **"não verificada"** (`origin: discovery`). A busca **nunca** mexe em bolsa verificada, cadastrada à mão ou ocultada por
um admin ou por relatos; reativa só as que tinham saído do ar por prazo vencido (ciclo novo).

**Onde roda:** GitHub Actions, workflow **"Bolsas: busca automática"**: toda segunda-feira (metade das fontes por semana, em rodízio) e
quando você mandar (**Actions → Bolsas: busca automática → Run workflow**; por padrão é um **ensaio**, que só mostra o que publicaria).

**Configurar uma vez** (GitHub → Settings → Secrets and variables → Actions → New repository secret):

| Segredo | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | chave da API do Claude (console.anthropic.com → API Keys). **Defina um limite de gasto mensal** em Billing. |
| `DATABASE_URL` | a mesma URL do Session pooler do Supabase usada na API do Render |

**Gasto:** cada fonte custa em média 0,30–0,60 USD (pesquisas + leitura das páginas); cada execução tem teto (`max_usd`, padrão 5 USD)
e para antes de passar dele. Com o rodízio semanal, estimativa de 10–20 USD por mês.

Da sua máquina (com `ANTHROPIC_API_KEY` e `DATABASE_URL` em `backend/.env`):

```bash
npm --prefix backend run discovery -- --dry-run --only=chevening
```

```bash
npm --prefix backend run discovery -- --all --max-usd=10
```

**Depois de cada execução:** em `/admin`, filtre **Não verificadas**, confira as bolsas novas com o edital e marque como verificadas
(ou oculte as erradas). Fonte nova: um item em `sources.ts`, sempre com o domínio do site oficial do programa.

## Painel de administração e qualidade das bolsas

**Dar acesso** (a pessoa cria a conta no site primeiro; depois sai e entra de novo para ver o menu **Admin**):

```bash
npm --prefix backend run admin:grant -- pessoa@exemplo.com
```

(Da sua máquina, com a URL externa da base em `backend/.env`. `--revoke` tira o acesso.)

Em **/admin**: todas as bolsas, as reportadas primeiro. Para cada uma: **verificar** (alguém conferiu com o edital hoje), **ocultar**
ou **pôr no ar**, **ver e resolver relatos** e **editar em JSON** (mesmo formato do importador). "Nova bolsa (JSON)" cadastra uma.

**Como as bolsas saem do ar sozinhas** (as novas entram publicadas como "não verificadas"):

| Situação | O que acontece |
|---|---|
| Prazo vencido | Fica oculta (`deadline_passed`) na partida da API e a cada 6 horas. Atualize o prazo do próximo ciclo e ponha no ar de novo. |
| 3 estudantes diferentes reportam link quebrado, bolsa encerrada ou golpe | Fica oculta (`reported`). Confira, corrija, resolva os relatos e ponha no ar. |
| Ocultada por um admin | Fica oculta até alguém pôr no ar. |

Rotina sugerida (semanal): `/admin` com **Só reportadas** → resolver; depois **Não verificadas** → conferir as mais recentes.

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
| Ninguém consegue entrar | Logs da API. `CORS_ORIGIN`/`APP_URL` batem com o endereço do site? Cookie bloqueado = site sem o repasse `/api` (`API_INTERNAL_URL`). Muitos `429` em `/auth/*` para todo mundo = o site não está mandando a chave interna (`INTERNAL_API_SECRET` igual nos dois serviços?): sem ela, o backend não sabe o IP de cada visitante. |
| Estudantes não recebem e-mail de nova senha | `EMAIL_PROVIDER=resend` e `RESEND_API_KEY` configurados? Domínio verificado no Resend? |
| Muitos `429` | Ataque ou um robô: veja os IPs nos logs. Os limites estão em `backend/src/app.ts`. |
| Migração falhou no deploy | A API não sobe (o `start:prod` migra antes). Rollback do deploy; corrija a migração num PR. A base não fica pela metade: cada migração roda numa transação. |

Depois de resolvido: registre o que aconteceu, a causa e o que evita a repetição (uma issue no GitHub serve).
