import { expect, test } from "./fixtures";

test("digitar antes de o JavaScript carregar não perde o que foi digitado", async ({ page, anonymous: _a }) => {
  // Atrasa o JavaScript do site em 3 s: a pessoa digita com a página ainda "crua" (só o HTML).
  await page.route("**/_next/static/chunks/**", async (route) => { await new Promise((r) => setTimeout(r, 3000)); await route.continue(); });
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Nome").fill("Ana Digitou Cedo");
  await page.getByLabel("E-mail").fill(`cedo-${Date.now()}@exemplo.com`);
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste-123");
  const button = page.getByRole("button", { name: "Criar conta gratuita" });
  await expect(button).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByLabel("Nome")).toHaveValue("Ana Digitou Cedo");
  await button.click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
});
