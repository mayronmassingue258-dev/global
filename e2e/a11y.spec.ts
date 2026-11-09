import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Acessibilidade automática (axe-core) nas regras WCAG 2.2 A/AA, inclusive contraste de cor medido na página renderizada.
 * Cada tela é verificada também em estados "difíceis": erros de formulário, painéis abertos, idioma inglês.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function expectNoViolations(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `Violações de acessibilidade em ${label}`).toEqual([]);
}

const pages = [
  "/",
  "/scholarships",
  "/scholarships?q=nada-encontrado",
  "/scholarships/amostra-002",
  "/eligibility/amostra-004",
  "/dashboard",
  "/applications",
  "/applications/amostra-001",
  "/profile",
  "/assistant",
  "/account",
  "/reset-password?token=exemplo",
  "/login",
  "/register",
  "/forgot-password",
  "/pagina-que-nao-existe"
];

for (const locale of ["pt", "en"] as const) {
  test.describe(`axe · ${locale}`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: "gs_locale", value: locale, url: baseURL! }]);
    });

    for (const path of pages) {
      test(`${path}`, async ({ page, api }) => {
        await api.post("/applications", { scholarshipId: "amostra-001" });
        await page.goto(path);
        await expectNoViolations(page, `${path} (${locale})`);
      });
    }
  });
}

test.describe("axe · estados", () => {
  test("perfil com erros de validação", async ({ page, api: _api }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Corrija" })).toBeVisible();
    await expectNoViolations(page, "perfil com erros");
  });

  test("cadastro com erros de validação", async ({ page, api: _api }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Criar conta gratuita" }).click();
    await expectNoViolations(page, "cadastro com erros");
  });

  test("busca com filtros e chips", async ({ page, api: _api }) => {
    await page.goto("/scholarships?q=Bolsa&level=Mestrado&sort=title");
    await expect(page.getByRole("list", { name: "Filtros ativos" })).toBeVisible();
    await expectNoViolations(page, "busca com chips");
  });

  test("candidatura com arquivo anexado, recusado e confirmação de remoção", async ({ page, api }) => {
    await api.post("/applications", { scholarshipId: "amostra-001" });
    await page.goto("/applications/amostra-001");
    await page.getByLabel("Arquivo para “Diploma”").setInputFiles({ name: "d.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF") });
    await page.getByLabel("Arquivo para “Carta de motivação”").setInputFiles({ name: "x.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") });
    await page.getByRole("button", { name: "Remover candidatura" }).click();
    await expectNoViolations(page, "candidatura com estados");
  });

  test("assistente com rascunho aberto e confirmação de exclusão", async ({ page, api: _api }) => {
    await page.goto("/assistant");
    await page.getByRole("button", { name: "Criar rascunho" }).click();
    await page.getByRole("textbox", { name: /Abertura/ }).fill("Texto de teste.");
    await page.getByRole("button", { name: "Excluir" }).click();
    await expectNoViolations(page, "assistente");
  });
});
