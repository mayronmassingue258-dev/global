import { expect, test } from "./fixtures";

test.describe("busca de bolsas", () => {
  test("da busca da página inicial até o detalhe", async ({ page, api: _api }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Buscar bolsas" }).fill("dados");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page).toHaveURL(/\/scholarships\?q=dados/);
    await expect(page.getByRole("status").filter({ hasText: "resultado" })).toHaveText("1 resultado");
    await page.getByRole("link", { name: "Bolsa de Mestrado em Ciência de Dados" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Bolsa de Mestrado em Ciência de Dados" })).toBeVisible();
    await expect(page.getByText("Universidade Exemplo Internacional").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documentos necessários" })).toBeVisible();
  });

  test("filtros, estado vazio e limpar filtros", async ({ page, api: _api }) => {
    await page.goto("/scholarships");
    const count = page.getByRole("status").filter({ hasText: "resultado" });
    await expect(count).toHaveText("6 resultados");

    await page.getByText("Filtros e ordenação").click();
    await page.getByLabel("Nível de estudo").selectOption("Mestrado");
    await expect(count).toHaveText("3 resultados");

    await page.getByLabel("País de destino").fill("Japão");
    await expect(page.getByText("Nenhuma bolsa encontrada")).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(count).toHaveText("6 resultados");
  });

  test("bolsa inexistente mostra 404", async ({ page, api: _api }) => {
    const response = await page.goto("/scholarships/nao-existe");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Esta página não existe." })).toBeVisible();
  });
});
