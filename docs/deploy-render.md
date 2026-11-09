# Deploy no Render (demonstração)

Este guia publica **duas** aplicações no [Render](https://render.com), na região Frankfurt (a mais próxima de Moçambique entre as do Render):

| Serviço | O que é | URL típica |
|---|---|---|
| `globalscholar-api-demo` | O servidor local (`mock-api`) rodando na nuvem | `https://globalscholar-api-demo.onrender.com/api` |
| `globalscholar-web` | O frontend Next.js em modo API real | `https://globalscholar-web.onrender.com` |

> **É uma demonstração, não produção.** A API de demonstração não tem login: **todos os visitantes compartilham o mesmo perfil e as mesmas candidaturas**.
> No plano gratuito o disco é temporário: os dados somem a cada novo deploy ou reinício, e o serviço "dorme" após ~15 min sem uso
> (a primeira visita depois disso demora ~1 min). Quando o backend do seu sócio existir, só a variável `NEXT_PUBLIC_API_BASE_URL` muda.

## Atualização: backend real com PostgreSQL (B1)

Desde a versão 2.0.0, o `render.yaml` cria também a base de dados **`globalscholar-db`** (PostgreSQL), e o serviço
`globalscholar-api-demo` passa a rodar o **backend real** (`backend/`), não mais a API de demonstração. O nome e a URL continuam
os mesmos, então o frontend não precisa de nenhuma mudança.

Quando esta versão chegar ao `main`:

1. No Render, abra **Blueprints → (o seu blueprint)**. Se aparecer **"Sync"** ou alterações pendentes, clique para aplicar:
   o Render cria a base `globalscholar-db` e atualiza o serviço da API.
2. Aguarde o serviço `globalscholar-api-demo` ficar *Live*. Na primeira subida ele aplica as migrações e cria as bolsas de demonstração.
3. Confira `https://globalscholar-api-demo.onrender.com/api/health` → `{"ok":true}` (agora isso também prova que a base responde).
4. Se o endereço do frontend não for `https://globalscholar-web.onrender.com`, ajuste `CORS_ORIGIN` em
   **globalscholar-api-demo → Environment**.

> **Atenção ao plano gratuito da base:** o Render **apaga** bases gratuitas 30 dias após a criação. Para dados que não podem
> se perder, mude o plano para *Basic* (≈ 6 USD/mês, com backups diários) em **globalscholar-db → Settings** antes disso.

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
