import { expect, test } from "./fixtures";

const TITLE = "Bolsa de Graduação em Engenharia";

test.describe("salvar bolsa e candidaturas", () => {
  test("salvar na busca persiste na API e aparece em candidaturas e no painel", async ({ page, api: _api }) => {
    await page.goto("/scholarships");
    const save = page.getByRole("button", { name: `Salvar: ${TITLE}` });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true");

    // Recarregar prova que o dado veio do servidor, não do estado em memória.
    await page.reload();
    await expect(page.getByRole("button", { name: `Salvar: ${TITLE}` })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("navigation", { name: "Área do estudante" }).getByRole("link", { name: "Candidaturas" }).click();
    await expect(page.getByRole("heading", { level: 2, name: TITLE })).toBeVisible();

    await page.getByRole("navigation", { name: "Área do estudante" }).getByRole("link", { name: "Painel" }).click();
    await expect(page.getByRole("region", { name: "Próximos prazos" }).getByRole("link", { name: TITLE })).toBeVisible();
  });

  test("mudar status e remover persistem após recarregar", async ({ page, api }) => {
    await api.post("/applications", { scholarshipId: "amostra-003" });
    await api.post("/applications", { scholarshipId: "amostra-001" });

    await page.goto("/applications");
    const status = page.getByLabel(`Status de ${TITLE}`);
    await status.selectOption("Preparing");
    await expect(status).toHaveValue("Preparing");
    // Espera a gravação terminar antes de recarregar.
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByLabel(`Status de ${TITLE}`)).toHaveValue("Preparing");

    await page.getByRole("button", { name: `Remover ${TITLE}` }).click();
    await expect(page.getByRole("heading", { name: TITLE })).toBeHidden();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Bolsa de Mestrado em Ciência de Dados" })).toBeVisible();
    await expect(page.getByRole("heading", { name: TITLE })).toBeHidden();
  });

  test("sem candidaturas mostra estado vazio com caminho para a busca", async ({ page, api: _api }) => {
    await page.goto("/applications");
    await expect(page.getByText("Nenhuma candidatura ainda")).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Buscar bolsas" }).click();
    await expect(page).toHaveURL(/\/scholarships$/);
  });
});

test.describe("detalhe da candidatura", () => {
  test("checklist, notas e linha do tempo persistem", async ({ page, api }) => {
    await api.post("/applications", { scholarshipId: "amostra-001" });
    await page.goto("/applications");
    await page.getByRole("link", { name: "Abrir Bolsa de Mestrado em Ciência de Dados" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Bolsa de Mestrado em Ciência de Dados" })).toBeVisible();
    await expect(page.getByText("0 de 4 prontos")).toBeVisible();
    await page.getByRole("checkbox", { name: "Diploma" }).check();
    await page.getByRole("checkbox", { name: "Histórico acadêmico" }).check();
    await expect(page.getByText("2 de 4 prontos")).toBeVisible();

    await page.getByLabel("Suas notas sobre esta candidatura").fill("Pedir carta de recomendação à professora Ana.");
    await expect(page.getByText("Notas salvas.")).toBeVisible();
    await page.getByLabel("Status", { exact: true }).selectOption("Preparing");
    await page.waitForLoadState("networkidle");

    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Diploma" })).toBeChecked();
    await expect(page.getByLabel("Suas notas sobre esta candidatura")).toHaveValue(/professora Ana/);
    const timeline = page.getByRole("list").filter({ hasText: "Bolsa salva para acompanhamento" });
    await expect(timeline.getByRole("listitem")).toHaveText([
      /Status alterado para “Preparando”/,
      /Notas atualizadas/,
      /Documento pronto: Histórico acadêmico/,
      /Documento pronto: Diploma/,
      /Bolsa salva para acompanhamento/
    ]);
    await expect(page.getByText("Candidatura · Preparando")).toBeVisible();
  });

  test("candidatura inexistente mostra estado de não encontrada", async ({ page, api: _api }) => {
    await page.goto("/applications/nao-existe");
    await expect(page.getByText("Candidatura não encontrada")).toBeVisible();
  });
});
