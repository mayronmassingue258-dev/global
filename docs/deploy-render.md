# Deploy no Render (demonstração)

Este guia publica **duas** aplicações no [Render](https://render.com), na região Frankfurt (a mais próxima de Moçambique entre as do Render):

| Serviço | O que é | URL típica |
|---|---|---|
| `globalscholar-api-demo` | O servidor local (`mock-api`) rodando na nuvem | `https://globalscholar-api-demo.onrender.com/api` |
| `globalscholar-web` | O frontend Next.js em modo API real | `https://globalscholar-web.onrender.com` |

> **É uma demonstração, não produção.** A API de demonstração não tem login: **todos os visitantes compartilham o mesmo perfil e as mesmas candidaturas**.
> No plano gratuito o disco é temporário: os dados somem a cada novo deploy ou reinício, e o serviço "dorme" após ~15 min sem uso
> (a primeira visita depois disso demora ~1 min). Quando o backend do seu sócio existir, só a variável `NEXT_PUBLIC_API_BASE_URL` muda.

## Passo a passo

1. Suba o projeto para o GitHub (veja [git-guide.md](./git-guide.md)) com o arquivo `render.yaml` na raiz.
2. No Render: **New → Blueprint**, conecte o GitHub e escolha o repositório. O Render lê o `render.yaml` e mostra os dois serviços.
3. Ele pede o valor de `NEXT_PUBLIC_API_BASE_URL`. Como a URL da API só existe depois do deploy, use o nome previsto:
   `https://globalscholar-api-demo.onrender.com/api` → **Apply**.
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

A lista completa de verificação para produção (domínio, monitoramento, cabeçalhos de segurança, Lighthouse) entra na Fase 4.
