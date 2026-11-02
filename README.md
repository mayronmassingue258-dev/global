# GlobalScholar — Frontend (ELEVATE)

Frontend em **Next.js 15 (App Router) + React 19 + TypeScript + CSS Modules**, com a linguagem visual ELEVATE:
preto e branco, serifa editorial (Playfair Display) + sans-serif (Inter), cartões escuros pontuais, fotografia no hero.
Idioma da interface: **português (pt-BR)**.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:3000  (usa dados de demonstração: .env.development)
npm run typecheck
npm run lint
npm run build
```

Requer Node.js 20.9+. As fontes (Inter e Playfair Display) são baixadas pelo `next/font` durante o build/dev.

## Modos de dados (explícito)

| Ambiente | Variável | Resultado |
|---|---|---|
| `npm run dev` | `NEXT_PUBLIC_DATA_MODE=mock` (em `.env.development`) | dados **fictícios**, com aviso visível na interface |
| `build`/produção | vazio (padrão) | usa a **API real** (`NEXT_PUBLIC_API_BASE_URL`) |

Se a API falhar, a interface mostra erro com “Tentar novamente”. **Nunca** há troca silenciosa por dados fictícios.
Para ver uma build de produção com mocks, crie `.env.production.local` com `NEXT_PUBLIC_DATA_MODE=mock`.

## Estrutura

```
src/
  app/
    (marketing)/   landing (hero com foto + seção de recursos)
    (auth)/        login, register, forgot-password
    (student)/     dashboard, scholarships, scholarships/[id], eligibility/[scholarshipId],
                   applications, profile, assistant  (layout com navegação, loading e erro)
  components/      ui (Button, ButtonLink, Field, Badge), feedback (Notice, EmptyState, ErrorState), layout
  features/        landing, auth, scholarships, applications, eligibility, profile, assistant
  lib/             config, constants, services (escolha mock/API), api (client, guards, scholarships), utils
  mocks/           dados e serviço de demonstração (isolados)
  styles/          tokens.css, typography.css, patterns.module.css
  types/           contratos PROVISÓRIOS
```

Fluxo: página → componente de feature → serviço (`lib/services.ts`) → cliente HTTP (`lib/api/client.ts`) → API.

## O que é real e o que é demonstração

- **Demonstração (não conectado):** autenticação (formulários só exibem aviso), salvamento do perfil, assistente de documentos
  (gera um roteiro local, **sem IA**), candidaturas (estado em memória, some ao recarregar), resultados de elegibilidade (fictícios).
- **Nada é gravado no navegador** (sem `localStorage`): perfil, documentos e sessão não são persistidos no cliente.
- **Elegibilidade:** o frontend apenas exibe o resultado vindo do serviço e os motivos; não calcula nada nem mostra probabilidades.
- “Enviada” em candidaturas significa apenas o que o estudante marcou; a plataforma não envia candidaturas.

## Dependências do backend (pendentes por natureza)

1. **Contrato da API**: caminhos em `src/lib/api/scholarships.ts` e tipos em `src/types/index.ts` são provisórios.
2. **Autenticação**: modelo de sessão (cookie vs. token) não definido; por isso o cliente HTTP não define `credentials`.
3. **Assistente de IA**: só pelo backend (nunca expor chave no navegador).
4. **Persistência** de perfil e candidaturas.

## Verificação realizada (neste ambiente, sem rede)

Feito: sintaxe TS/TSX de todos os 49 arquivos; checagem estrita de tipos nas camadas `types`, `lib` e `mocks`;
15 testes lógicos do serviço mock, formatação de datas e validadores; renderização no servidor de todos os componentes e páginas;
renderização real dos estilos (CSS Modules) em HTML e verificação de ausência de rolagem horizontal em 9 telas × 3 larguras (1280, 820, 375).

**Não feito (exige rede/máquina local):** `npm install`, `npm run lint`, `npm run build`, teste em navegador real e em aparelhos,
medição formal de contraste e Lighthouse. Rode `npm run typecheck && npm run lint && npm run build` e corrija qualquer ajuste de versão.

## Observações

- `public/images/hero-student-skyline.jpg` tem 768 px de largura; para telas grandes use uma versão em maior resolução
  (e confirme a licença de uso da imagem).
- Textos estão nos componentes; para múltiplos idiomas será preciso extrair para um dicionário (i18n).
- Não há links legais/contato no rodapé: entram quando existir conteúdo real.
