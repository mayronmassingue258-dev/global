#!/usr/bin/env node
// Orçamento de tamanho: mede o JavaScript e o CSS (gzip) que cada página carrega na primeira visita
// (layouts + página), a partir do manifesto do build. Rode depois de `npm run build`:
//   npm run size
// Termina com erro se alguma página passar do orçamento. Ajuste os limites só com um motivo registrado no PR.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export const BUDGET = { js: 150 * 1024, css: 20 * 1024 };

const dist = process.env.NEXT_DIST_DIR || ".next";
const manifestPath = join(dist, "app-build-manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`Manifesto não encontrado em ${manifestPath}. Rode "npm run build" antes.`);
  process.exit(1);
}
const { pages } = JSON.parse(readFileSync(manifestPath, "utf8"));

const cache = new Map();
const gz = (file) => {
  if (!cache.has(file)) cache.set(file, gzipSync(readFileSync(join(dist, file))).length);
  return cache.get(file);
};

/** Layouts que envolvem a página: "/(student)/scholarships/[id]/page" → "/layout", "/(student)/layout", ... */
function layoutsFor(page) {
  const parts = page.replace(/\/page$/, "").split("/").filter(Boolean);
  const chain = ["/layout"];
  for (let i = 1; i <= parts.length; i += 1) chain.push(`/${parts.slice(0, i).join("/")}/layout`);
  return chain.filter((key) => pages[key]);
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const rows = [];
let failed = 0;
for (const page of Object.keys(pages).filter((p) => p.endsWith("/page")).sort()) {
  const files = new Set([...layoutsFor(page), page].flatMap((key) => pages[key]));
  let js = 0;
  let css = 0;
  for (const file of files) {
    if (file.endsWith(".js")) js += gz(file);
    else if (file.endsWith(".css")) css += gz(file);
  }
  const ok = js <= BUDGET.js && css <= BUDGET.css;
  if (!ok) failed += 1;
  const route = page.replace(/\/page$/, "").replace(/\/\([^)]+\)/g, "") || "/";
  rows.push(`| \`${route}\` | ${kb(js)} | ${kb(css)} | ${ok ? "dentro" : "**ACIMA**"} |`);
}

console.log(`Orçamento por página (gzip): JS ≤ ${kb(BUDGET.js)}, CSS ≤ ${kb(BUDGET.css)}\n`);
console.log("| Página | JS | CSS | Orçamento |\n|---|---|---|---|");
console.log(rows.join("\n"));
if (failed) {
  console.error(`\n${failed} página(s) acima do orçamento.`);
  process.exit(1);
}
