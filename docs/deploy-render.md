# Deploy no Render (demonstração)

Este guia publica **duas** aplicações no [Render](https://render.com), na região Frankfurt (a mais próxima de Moçambique entre as do Render):

| Serviço | O que é | URL típica |
|---|---|---|
| `globalscholar-api-demo` | O servidor local (`mock-api`) rodando na nuvem | `https://globalscholar-api-demo.onrender.com/api` |
| `globalscholar-web` | O frontend Next.js em modo API real | `https://globalscholar-web.onrender.com` |

> **É uma demonstração, não produção.** A API de demonstração não tem login: **todos os visitantes compartilham o mesmo perfil e as mesmas candidaturas**.
> No plano gratuito o disco é temporário: os dados somem a cada novo deploy ou reinício, e o serviço "dorme" após ~15 min sem uso
> (a primeira visita depois disso demora ~1 min). Quando o backend do seu sócio existir, só a variável `NEXT_PUBLIC_API_BASE_URL` muda.

## Atualização: backend real (B1)

Desde a versão 2.0.0, o serviço `globalscholar-api-demo` roda o **backend real** (`backend/`), não mais a API de demonstração.
O nome e a URL continuam os mesmos. A base de dados é o **Supabase** (seção abaixo); a primeira versão do blueprint criava uma base
`globalscholar-db` no Render, que não é mais usada e pode ser apagada.

## Base de dados no Supabase

A base de dados fica no **Supabase** (PostgreSQL gerenciado); o Render roda só o site e a API.

### 1. Criar o projeto no Supabase

1. Em [supabase.com](https://supabase.com) → **New project**. Região: **Central EU (Frankfurt)**, a mesma do Render.
2. Defina uma **senha forte** para a base e guarde num gerenciador de senhas (ela entra na URL de conexão).
3. **Segurança:** em **Project Settings → Data API**, se você não for usar a API automática do Supabase, **desligue-a**
   (ou tire `public` de *Exposed schemas*). Mesmo sem isso, o backend liga o RLS em todas as tabelas, então a chave pública
   do Supabase não lê nada. As duas proteções juntas são o ideal.

### 2. Pegar a URL de conexão certa

No Supabase → botão **Connect** (topo do projeto) → **Session pooler**. A URL tem este formato:

```
postgresql://postgres.SEU_REF:SUA_SENHA@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

> Use o **Session pooler (porta 5432)**. A conexão *Direct* do plano gratuito é só IPv6, e o Render não a alcança.
> Se usar o *Transaction pooler* (porta 6543), adicione também `DATABASE_PREPARE=0`.
> Senha com caracteres especiais (`@`, `#`, `/`…) precisa estar codificada na URL (ex.: `@` → `%40`).

### 3. Ligar no Render

1. **globalscholar-api-demo → Environment**: `DATABASE_URL` = a URL acima (o `render.yaml` já define `DATABASE_SSL=require`).
2. **Save, rebuild and deploy.** Na subida, a API cria as tabelas (migrações) e as bolsas de demonstração.
3. Confira `https://globalscholar-api-demo.onrender.com/api/health` → `{"ok":true}`. No Supabase → **Table Editor**, as tabelas
   aparecem com o selo **RLS enabled**.
4. Se existir uma base `globalscholar-db` criada antes no Render, ela não é mais usada: pode apagá-la.

### Cuidados do plano gratuito do Supabase

- **Pausa por inatividade:** projetos gratuitos são pausados depois de cerca de 1 semana sem uso. É só reativar no painel,
  mas o site fica sem dados até lá. O monitoramento de `/api/health` (ver operations.md) acessa a base e ajuda a evitar a pausa.
- **Espaço:** 500 MB no plano gratuito, incluindo os **arquivos anexados** pelos estudantes. Acompanhe em **Reports → Database**.
- **Backups:** o plano gratuito não tem backups para baixar. Antes de ter estudantes reais, passe ao plano **Pro** (backups diários)
  ou faça backups manuais com `pg_dump` (comandos em operations.md).

## Atualização: anexos e privacidade (B3)

Ao aplicar o **Sync** do blueprint da versão 2.2.0:

- **globalscholar-api-demo** ganha `INTERNAL_API_SECRET` (gerado pelo Render) e **globalscholar-web** passa a lê-lo. Com ele, as
  páginas renderizadas pelo site não dividem o limite de requisições de um único IP.
- **globalscholar-web** ganha `NEXT_PUBLIC_UPLOADS_ENABLED=true`: os estudantes passam a anexar arquivos de verdade (até 10 MB),
  guardados na base de dados (Supabase: 500 MB no plano gratuito). Acompanhe o espaço e passe ao plano Pro antes de ter
  estudantes reais.

## Atualização: contas (B2)

A partir da versão 2.1.0 o site tem login de verdade. O `render.yaml` já traz as mudanças; ao aplicar o **Sync** do blueprint:

- **globalscholar-web:** `NEXT_PUBLIC_API_BASE_URL` passa a ser `/api` e entra `API_INTERNAL_URL` (endereço do backend). O site repassa
  `/api` ao backend, então o cookie de login funciona em todos os navegadores (inclusive Safari/iPhone).
- **globalscholar-api-demo:** entram `APP_URL` (para os links de e-mail) e `EMAIL_PROVIDER=log`.

Depois do deploy: abra o site, crie uma conta, saia e entre de novo.

**E-mail de "esqueci a senha":** com `EMAIL_PROVIDER=log`, o link aparece só em **globalscholar-api-demo → Logs** (útil para testar;
os estudantes não recebem nada). Para enviar de verdade:

1. Crie uma conta em [resend.com](https://resend.com) e uma API key.
2. Em **globalscholar-api-demo → Environment**: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY=<a chave>` (como *secret*).
3. Para enviar a qualquer pessoa, verifique um domínio seu no Resend e defina `EMAIL_FROM`, ex.: `GlobalScholar <nao-responda@seudominio.com>`.
   Sem domínio verificado, o Resend só entrega para o e-mail da sua própria conta (bom para testar).

## Passo a passo

1. Suba o projeto para o GitHub (veja [git-guide.md](./git-guide.md)) com o arquivo `render.yaml` na raiz.
2. No Render: **New → Blueprint**, conecte o GitHub e escolha o repositório. O Render lê o `render.yaml` e mostra os dois serviços.
3. Ele pede dois valores. Como as URLs só existem depois do deploy, use os nomes previstos:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://globalscholar-api-demo.onrender.com/api`
   - `NEXT_PUBLIC_SITE_URL` = `https://globalscholar-web.onrender.com`

   → **Apply**.
4. Quando os dois ficarem *Live*, abra a URL da API + `/api/health`. Deve aparecer `{"ok":true}`.
   - Se o Render tiver dado outro endereço à API (ex.: com sufixo), copie a URL real, atualize `NEXT_PUBLIC_API_BASE_URL` em
     **globalscholar-web → Environment** e faça **Manual Deploy → Clear build cache & deploy** (a variável entra no build).
5. Abra o frontend, salve uma bolsa, recarregue: ela deve continuar salva.
6. (Recomendado) Em **globalscholar-api-demo → Environment**, troque `CORS_ORIGIN` de `*` para a URL exata do frontend.

## Alternativa: um serviço só, sem API

Para mostrar só o visual, crie apenas o `globalscholar-web` com `NEXT_PUBLIC_DATA_MODE=mock`.
A interface exibe o aviso "Modo demonstração" e nada é gravado.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Páginas com "Não foi possível carregar" | `NEXT_PUBLIC_API_BASE_URL` errada, sem `/api` no fim, ou API dormindo (espere 1 min e recarregue). |
| Funciona no servidor, falha no navegador (erro de CORS no console) | `CORS_ORIGIN` diferente da URL do frontend (sem barra no fim). |
| Mudei a variável e nada mudou | Variáveis `NEXT_PUBLIC_*` são gravadas no build: faça *Clear build cache & deploy*. |
| Build falha com "Cannot find module 'typescript'" | O comando de build precisa de `npm ci --include=dev`. |
| Mudei a URL da API e as páginas dão erro de rede no console ("Content Security Policy") | A CSP libera só a origem configurada no build: faça *Clear build cache & deploy* depois de mudar a variável. |

A verificação a cada publicação (e antes do lançamento público) está em [deploy-checklist.md](./deploy-checklist.md).
