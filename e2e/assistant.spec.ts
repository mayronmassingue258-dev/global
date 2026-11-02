import { expect, test } from "./fixtures";

test.describe("assistente de documentos", () => {
  test("cria rascunho, escreve por seção e o texto persiste após recarregar", async ({ page, api: _api }) => {
    await page.goto("/assistant");
    await expect(page.getByRole("heading", { name: "O que você vai escrever?" })).toBeVisible();
    await page.getByLabel(/Declaração pessoal/).check();
    await page.getByLabel("Título do rascunho (opcional)").fill("Declaração — Políticas Públicas");
    await page.getByRole("button", { name: "Criar rascunho" }).click();

    await expect(page).toHaveURL(/\/assistant\?draft=/);
    const outline = page.getByRole("navigation", { name: "Estrutura do documento" });
    await expect(outline.getByRole("link")).toHaveText([/De onde você vem/, /Um desafio/, /O que aprendeu/, /Para onde vai/]);

    const challenge = page.getByRole("textbox", { name: /Um desafio/ });
    await challenge.fill("Coordenei um projeto de saneamento em Maputo com doze voluntários.");
    await expect(page.getByText(/^Salvo ·/)).toBeVisible();
    await expect(outline.getByRole("link", { name: /Um desafio/ })).toContainText("10");

    await page.reload();
    await expect(page.getByRole("textbox", { name: /Um desafio/ })).toHaveValue(/saneamento em Maputo/);
    await expect(page.getByRole("button", { name: /Declaração — Políticas Públicas/ })).toHaveAttribute("aria-current", "true");
  });

  test("a candidatura leva ao assistente com o programa preenchido", async ({ page, api }) => {
    await api.post("/applications", { scholarshipId: "amostra-006" });
    await page.goto("/applications/amostra-006");
    await page.getByRole("link", { name: "Escrever um documento para esta bolsa" }).click();
    await expect(page.getByLabel("Bolsa ou programa (opcional)")).toHaveValue("Mestrado em Políticas Públicas");
  });
});
