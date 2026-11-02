import { expect, test } from "./fixtures";

test("assistente monta um roteiro local com o texto do estudante", async ({ page, api: _api }) => {
  await page.goto("/assistant");
  await page.getByRole("button", { name: "Criar roteiro" }).click();
  await expect(page.getByRole("status").filter({ hasText: "experiência real" })).toBeVisible();

  await page.getByLabel("Declaração pessoal").check();
  await page.getByLabel("Bolsa ou programa").fill("Mestrado em Políticas Públicas");
  await page.getByLabel("Sua experiência real e seus objetivos").fill("Voluntário em projeto de saneamento em Maputo.");
  await page.getByRole("button", { name: "Criar roteiro" }).click();

  const draft = page.getByLabel("Conteúdo do rascunho");
  await expect(draft).toHaveValue(/DECLARAÇÃO PESSOAL/);
  await expect(draft).toHaveValue(/Voluntário em projeto de saneamento em Maputo\./);
  await expect(page.getByText("Nenhum serviço de IA está conectado.")).toBeVisible();
});
