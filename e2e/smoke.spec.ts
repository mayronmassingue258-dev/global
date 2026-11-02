import { expect, test } from "./fixtures";

// Roda também no perfil "mobile": checa que as telas principais abrem sem erro e sem rolagem horizontal.
const pages = ["/", "/dashboard", "/scholarships", "/scholarships/amostra-002", "/eligibility/amostra-001", "/applications", "/applications/amostra-003", "/profile", "/assistant", "/login", "/register"];

for (const path of pages) {
  test(`abre ${path}`, async ({ page, api }) => {
    await api.post("/applications", { scholarshipId: "amostra-003" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test("link 'Pular para o conteúdo' é o primeiro foco da página", async ({ page, api: _api }) => {
  await page.goto("/scholarships");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
});
