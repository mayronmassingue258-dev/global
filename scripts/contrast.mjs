#!/usr/bin/env node
// Mede o contraste (WCAG 2.x) dos pares de cor usados na interface, lendo os valores de src/styles/tokens.css.
// `npm run contrast` imprime a tabela; termina com erro se algum par ficar abaixo do mínimo.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const tokens = Object.fromEntries([...css.matchAll(/--(color-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [texto, fundo, uso, mínimo] — 4.5 para texto normal, 3 para texto grande/elementos gráficos.
const pairs = [
  ["color-text", "color-paper", "Texto principal sobre o fundo", 4.5],
  ["color-text-2", "color-paper", "Texto secundário sobre o fundo", 4.5],
  ["color-text-muted", "color-paper", "Rótulos e metadados sobre o fundo", 4.5],
  ["color-text-2", "color-card", "Texto secundário em cartões", 4.5],
  ["color-text-muted", "color-card", "Metadados em cartões", 4.5],
  ["color-text-2", "color-surface", "Avisos (Notice)", 4.5],
  ["color-text-muted", "color-surface", "Faixa de demonstração", 4.5],
  ["color-on-dark", "color-ink-2", "Texto em cartões escuros", 4.5],
  ["color-on-dark-2", "color-ink-2", "Texto secundário em cartões escuros", 4.5],
  ["color-success", "color-success-bg", "Selo verde (Integral, Elegível)", 4.5],
  ["color-warning", "color-warning-bg", "Selo âmbar (Parcial, Faltam informações)", 4.5],
  ["color-danger", "color-danger-bg", "Selo vermelho e erros de envio", 4.5],
  ["color-danger", "color-paper", "Mensagens de erro de campo", 4.5],
  ["color-urgent-on-dark", "color-ink-2", "Prazo urgente no cartão escuro", 4.5],
  ["color-soon-on-dark", "color-ink-2", "Prazo próximo no cartão escuro", 4.5],
  ["color-on-dark-2", "color-ink", "Texto secundário na landing (hero e fechamento)", 4.5],
  ["color-border-strong", "color-paper", "Borda de campos (componente de interface)", 3],
  ["color-border-strong", "color-card", "Borda de campos em cartões", 3]
];

let failed = 0;
console.log("| Uso | Texto | Fundo | Contraste | Mínimo | Resultado |\n|---|---|---|---|---|---|");
for (const [fg, bg, use, min] of pairs) {
  const r = ratio(tokens[fg], tokens[bg]);
  const ok = r >= min;
  if (!ok) failed += 1;
  console.log(`| ${use} | \`${tokens[fg]}\` | \`${tokens[bg]}\` | ${r.toFixed(2)}:1 | ${min}:1 | ${ok ? "passa" : "**FALHA**"} |`);
}
if (failed) {
  console.error(`\n${failed} par(es) abaixo do mínimo.`);
  process.exit(1);
}
