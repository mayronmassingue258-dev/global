import { expect, test } from "./fixtures";

test.describe("perfil e elegibilidade", () => {
  test("erros de validação levam o foco ao primeiro campo", async ({ page, api: _api }) => {
    await page.goto("/profile");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Corrija os campos" })).toBeVisible();
    await expect(page.getByLabel("País de residência")).toBeFocused();
    await expect(page.getByLabel("País de residência")).toHaveAttribute("aria-invalid", "true");
  });

  test("o perfil salvo muda o resultado de elegibilidade calculado pelo servidor", async ({ page, api: _api }) => {
    const main = page.getByRole("main");
    await page.goto("/eligibility/amostra-004");
    await expect(main.getByText("Faltam informações", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Completar perfil" }).click();

    await page.getByLabel("País de residência").fill("Moçambique");
    await page.getByLabel("Nível de estudo atual").selectOption("Mestrado");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByText("Perfil salvo.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("País de residência")).toHaveValue("Moçambique");

    await page.goto("/eligibility/amostra-004");
    await expect(main.getByText("Não elegível", { exact: true })).toBeVisible();
    await expect(main.getByText(/país de residência fora da lista/)).toBeVisible();

    await page.goto("/profile");
    await page.getByLabel("País de residência").fill("Suíça");
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByText("Perfil salvo.")).toBeVisible();

    await page.goto("/eligibility/amostra-004");
    await expect(main.getByText("Elegível", { exact: true })).toBeVisible();
    await expect(main.getByText(/não garante aprovação/)).toBeVisible();
  });
});

test("detalhe da bolsa mostra prazo e o que falta no perfil", async ({ page, api }) => {
  await page.goto("/scholarships/amostra-002");
  const aside = page.getByRole("complementary", { name: "Resumo e próximos passos" });
  await expect(aside.getByText("Prazo listado")).toBeVisible();
  await expect(aside.getByText(/Faltam \d+ dias|Termina|Prazo encerrado/)).toBeVisible();
  await expect(aside.getByText("4 itens pendentes no seu perfil.")).toBeVisible();

  await api.put("/profile", { residence: "Moçambique", level: "Mestrado", grade: "16 em 20", languages: "Inglês C1" });
  await page.reload();
  await expect(aside.getByText("Nada pendente no seu perfil para esta bolsa.")).toBeVisible();
  await expect(aside.getByRole("link", { name: "Completar perfil" })).toHaveCount(0);
});
