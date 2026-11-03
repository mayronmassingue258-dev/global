# Acessibilidade

Meta: **WCAG 2.2 nível AA**. O que está abaixo é verificado automaticamente a cada pull request (CI) — não é uma promessa de papel.

## O que os testes cobrem

| Verificação | Onde | O que garante |
|---|---|---|
| **axe-core** (regras WCAG 2.0/2.1/2.2 A e AA + boas práticas) | `e2e/a11y.spec.ts` | 14 telas × 2 idiomas, mais 5 estados difíceis (erros de formulário, chips de filtro, arquivo recusado, confirmações abertas). Inclui contraste medido na página renderizada. Zero violações exigidas. |
| **Contraste dos tokens** | `npm run contrast` (`scripts/contrast.mjs`) | Cada par texto/fundo da paleta, com a razão calculada pela fórmula da WCAG. Falha o CI se algum par cair abaixo do mínimo. |
| **Só teclado** | `e2e/keyboard.spec.ts` | Fluxo completo sem mouse: pular para o conteúdo → buscar → salvar bolsa (Espaço) → abrir candidatura → marcar documento → mudar status (setas); chips de filtro; ordem de Tab do perfil; escolha do tipo de documento com setas. Em cada parada, verifica que o foco está **visível**. |
| **Componentes** | `*.test.tsx` (Testing Library) | Rótulos ligados aos campos, mensagens de erro em `aria-describedby`, `aria-invalid`, `aria-pressed`, regiões `role="status"`/`"alert"`, foco no primeiro erro. |
| **Telas em celular** | `e2e/smoke.spec.ts` (Pixel 7) | Sem rolagem horizontal e sem erros no console. |

## Contraste medido

Valores de `src/styles/tokens.css` (rode `npm run contrast` para atualizar):

| Uso | Texto | Fundo | Contraste | Mínimo | Resultado |
|---|---|---|---|---|---|
| Texto principal sobre o fundo | `#111111` | `#f4f3ef` | 17.01:1 | 4.5:1 | passa |
| Texto secundário sobre o fundo | `#555550` | `#f4f3ef` | 6.75:1 | 4.5:1 | passa |
| Rótulos e metadados sobre o fundo | `#62625c` | `#f4f3ef` | 5.53:1 | 4.5:1 | passa |
| Texto secundário em cartões | `#555550` | `#ffffff` | 7.50:1 | 4.5:1 | passa |
| Metadados em cartões | `#62625c` | `#ffffff` | 6.14:1 | 4.5:1 | passa |
| Avisos (Notice) | `#555550` | `#eceae4` | 6.23:1 | 4.5:1 | passa |
| Faixa de demonstração | `#62625c` | `#eceae4` | 5.10:1 | 4.5:1 | passa |
| Texto em cartões escuros | `#ffffff` | `#141414` | 18.42:1 | 4.5:1 | passa |
| Texto secundário em cartões escuros | `#c8c8c3` | `#141414` | 10.97:1 | 4.5:1 | passa |
| Selo verde (Integral, Elegível) | `#15703f` | `#e7f4ec` | 5.42:1 | 4.5:1 | passa |
| Selo âmbar (Parcial, Faltam informações) | `#8a5a00` | `#fbf1da` | 5.28:1 | 4.5:1 | passa |
| Selo vermelho e erros de envio | `#b42318` | `#fdecea` | 5.75:1 | 4.5:1 | passa |
| Mensagens de erro de campo | `#b42318` | `#f4f3ef` | 5.92:1 | 4.5:1 | passa |
| Prazo urgente no cartão escuro | `#ffb4a8` | `#141414` | 10.83:1 | 4.5:1 | passa |
| Prazo próximo no cartão escuro | `#f5d28c` | `#141414` | 12.70:1 | 4.5:1 | passa |
| Texto secundário na landing (hero e fechamento) | `#c8c8c3` | `#080808` | 11.93:1 | 4.5:1 | passa |
| Borda de campos (componente de interface) | `#8c8b85` | `#f4f3ef` | 3.08:1 | 3:1 | passa |
| Borda de campos em cartões | `#8c8b85` | `#ffffff` | 3.42:1 | 3:1 | passa |

## Problemas encontrados e corrigidos na Fase 4

| Problema | Critério WCAG | Correção |
|---|---|---|
| Verde dos selos ("Integral", "Elegível") com 4,44:1 | 1.4.3 Contraste | `--color-success` de `#1a7f4b` para `#15703f` (5,42:1). |
| Seletor de idioma: nome acessível "Português" com texto visível "PT" | 2.5.3 Rótulo no nome | Nome passou a ser "PT · Português" (começa pelo texto visível, para comando de voz). |
| Títulos dos cartões na busca pulavam de h1 para h3 | 1.3.1 Informação e relações | Cartão aceita nível de título; na busca usa h2. |
| (Fase 1) Página de elegibilidade sem h1 | 2.4.6 / 1.3.1 | h1 com o nome da bolsa. |
| (Fase 2) Desenho do checkbox cobria o controle nativo | 2.5.8 Tamanho do alvo | Controle nativo por cima, invisível; o desenho só reflete o estado. |

## Decisões de projeto

- Status e urgência **nunca só por cor**: selos têm texto e marcador de forma diferente; prazos dizem "Faltam 9 dias".
- Campos personalizados (checkbox, cartões de rádio) usam o controle nativo por baixo: teclado, leitores de tela e preenchimento funcionam como no padrão do navegador.
- Animações respeitam `prefers-reduced-motion`.
- O idioma da página (`<html lang>`) acompanha o seletor; o nome de cada idioma no seletor tem o `lang` próprio.

## O que a automação NÃO garante (testar à mão antes do lançamento)

- [ ] Leitor de tela real: NVDA + Firefox (Windows) e VoiceOver + Safari (iPhone) nos fluxos de busca, perfil e candidatura.
- [ ] Zoom de 200% e texto ampliado no celular (Configurações → Tamanho da fonte).
- [ ] Clareza dos textos para quem lê em segunda língua (o público é internacional).
- [ ] Contraste das **fotos reais** quando forem adicionadas (o fechamento tem um degradê escuro para proteger o texto).
