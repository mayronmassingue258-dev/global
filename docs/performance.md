# Performance

## Orçamento de tamanho

`npm run size` (depois do build) mede o JavaScript e o CSS, comprimidos com gzip, que cada página carrega na primeira visita
(layouts + página). Roda no CI: uma página acima do limite reprova o pull request.

Orçamento por página (gzip): JS ≤ 150.0 KB, CSS ≤ 20.0 KB

| Página | JS | CSS | Orçamento |
|---|---|---|---|
| `/forgot-password` | 119.3 KB | 8.9 KB | dentro |
| `/login` | 119.3 KB | 8.9 KB | dentro |
| `/register` | 119.3 KB | 8.9 KB | dentro |
| `/` | 123.4 KB | 10.0 KB | dentro |
| `/applications/[id]` | 130.7 KB | 9.1 KB | dentro |
| `/applications` | 128.3 KB | 9.5 KB | dentro |
| `/assistant` | 135.8 KB | 10.2 KB | dentro |
| `/dashboard` | 128.7 KB | 9.5 KB | dentro |
| `/eligibility/[scholarshipId]` | 125.4 KB | 9.8 KB | dentro |
| `/profile` | 127.3 KB | 9.1 KB | dentro |
| `/scholarships/[id]` | 127.7 KB | 9.5 KB | dentro |
| `/scholarships` | 130.7 KB | 9.5 KB | dentro |
| `/_not-found` | 113.2 KB | 8.9 KB | dentro |

Para aumentar o limite, registre o motivo no PR (ex.: biblioteca nova necessária) e ajuste `BUDGET` em `scripts/check-bundle-size.mjs`.

## Imagens

- Todas as fotos passam pelo `next/image`: o navegador recebe **AVIF** ou **WebP** (configurado em `next.config.ts`) no tamanho certo
  para a tela (`sizes` em cada uso), com carregamento preguiçoso fora da primeira dobra.
- A foto do topo da landing é o elemento LCP: tem `priority` e `fetchPriority="high"`.
- O JPG original continua sendo a fonte; não é preciso converter nada à mão. Veja `public/images/README.md` para tamanhos recomendados.

## Lighthouse

Resultado completo em [`lighthouse-report.md`](./lighthouse-report.md) (build de produção + API local, nesta máquina de desenvolvimento).
Resumo: **Performance 95–100, Acessibilidade 100, Boas práticas 100, SEO 100** em celular e desktop nas páginas medidas; CLS 0.

Como medir de novo:

```bash
npm run mock-api
```

```bash
npm run build && npm start
```

(com `NEXT_PUBLIC_DATA_MODE=api` e `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api` em `.env.production.local`)

```bash
npm run lighthouse -- http://localhost:3000
```

Depois do deploy, rode também contra a URL do Render: lá a latência real da rede e o "acordar" do plano gratuito pesam.

## Melhorias feitas na Fase 4

| Mudança | Efeito medido |
|---|---|
| `fetchPriority="high"` na foto do hero | Landing no celular: Performance 84 → 95–96 |
| Metadados no `<head>` para todos (`htmlLimitedBots`) | SEO 91–92 → 100; pré-visualização de links correta em apps de mensagem |
| Cadastro/login indexáveis (coerente com o sitemap) | SEO do login 63 → 100 |

## Pontos de atenção conhecidos

- Os dois dicionários (pt e en) vão no JavaScript de todas as páginas (~6 KB gzip cada), porque têm funções (plurais) que não
  atravessam do servidor para o cliente. Se o número de idiomas crescer, carregar o dicionário do idioma ativo sob demanda.
- Ler o cookie de idioma torna as páginas dinâmicas (renderizadas a cada pedido). No Render isso é barato; se o tráfego crescer,
  avaliar rotas por idioma (`/en/...`) com páginas estáticas.
- No plano gratuito do Render, o primeiro acesso após inatividade leva ~1 minuto (o serviço "acorda"). Isso não aparece no Lighthouse local.
