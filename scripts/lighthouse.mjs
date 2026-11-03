#!/usr/bin/env node
// Lighthouse nas páginas principais (celular e desktop), usando o Chromium do Playwright.
// Pré-requisito: o site rodando em modo produção. Ex.:
//   terminal 1: npm run mock-api
//   terminal 2: npm run build && npm start      (com NEXT_PUBLIC_DATA_MODE=api e NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api)
//   terminal 3: npm run lighthouse -- http://localhost:3000
// Gera docs/lighthouse-report.md (tabela) e os relatórios HTML em lighthouse-reports/ (fora do git).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const pages = ["/", "/scholarships", "/scholarships/amostra-001", "/login"];
const outDir = "lighthouse-reports";
mkdirSync(outDir, { recursive: true });

const rows = [];
for (const preset of ["mobile", "desktop"]) {
  for (const path of pages) {
    const slug = `${preset}${path.replace(/[^a-z0-9]+/gi, "-")}`.replace(/-$/, "");
    const args = [
      "--yes", "lighthouse@13.6.0", `${base}${path}`,
      "--quiet", "--output=json", "--output=html", `--output-path=${outDir}/${slug}`,
      "--only-categories=performance,accessibility,best-practices,seo",
      `--chrome-flags=--headless=new --no-sandbox`,
      ...(preset === "desktop" ? ["--preset=desktop"] : [])
    ];
    execFileSync("npx", args, { stdio: "inherit", env: { ...process.env, CHROME_PATH: chromium.executablePath() } });
    const report = JSON.parse(readFileSync(`${outDir}/${slug}.report.json`, "utf8"));
    const score = (k) => Math.round((report.categories[k]?.score ?? 0) * 100);
    const audit = (k) => report.audits[k]?.displayValue ?? "—";
    rows.push(`| ${preset === "mobile" ? "Celular" : "Desktop"} | \`${path}\` | ${score("performance")} | ${score("accessibility")} | ${score("best-practices")} | ${score("seo")} | ${audit("largest-contentful-paint")} | ${audit("total-blocking-time")} | ${audit("cumulative-layout-shift")} |`);
  }
}

const md = `# Relatório Lighthouse

Gerado por \`npm run lighthouse\` em ${new Date().toISOString().slice(0, 10)} contra \`${base}\` (build de produção + API local).
Celular = emulação padrão do Lighthouse (Moto G Power, 4G lento, CPU 4× mais lenta). Desktop = preset "desktop".

| Perfil | Página | Performance | Acessibilidade | Boas práticas | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
${rows.join("\n")}
`;
writeFileSync("docs/lighthouse-report.md", md);
console.log(md);
