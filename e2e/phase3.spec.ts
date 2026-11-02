import { expect, test } from "./fixtures";

test.describe("busca compartilhável", () => {
  test("filtros vão para a URL, o link restaura a busca e 'voltar' funciona", async ({ page, api: _api }) => {
    await page.goto("/scholarships");
    await page.getByLabel("Buscar bolsas").fill("Mestrado");
    await expect(page).toHaveURL(/\/scholarships\?q=Mestrado$/);
    await page.getByText("Filtros e ordenação").click();
    await page.getByLabel("Ordenar por").selectOption("title");
    await expect(page).toHaveURL(/q=Mestrado&sort=title$/);

    const chips = page.getByRole("list", { name: "Filtros ativos" });
    await expect(chips.getByRole("button")).toHaveText(["“Mestrado”", "Ordem: título"]);

    // Abrir o mesmo link numa aba nova reproduz a busca.
    const shared = await page.context().newPage();
    await shared.goto(page.url());
    await expect(shared.getByLabel("Buscar bolsas")).toHaveValue("Mestrado");
    await expect(shared.getByLabel("Ordenar por")).toHaveValue("title");
    await shared.close();

    await page.goBack();
    await expect(page).toHaveURL(/\/scholarships\?q=Mestrado$/);
    await expect(page.getByLabel("Ordenar por")).toHaveValue("deadline");

    await chips.getByRole("button", { name: "Remover filtro: “Mestrado”" }).click();
    await expect(page).toHaveURL(/\/scholarships$/);
    await expect(page.getByLabel("Buscar bolsas")).toHaveValue("");
  });
});

test.describe("idiomas", () => {
  test("trocar para inglês vale para todo o site e fica guardado", async ({ page, api: _api }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await page.getByRole("group", { name: "Idioma" }).first().getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Global Scholarship Platform");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.goto("/scholarships/amostra-001");
    await expect(page.getByRole("heading", { name: "Required documents" })).toBeVisible();
    await expect(page.getByText("Scholarship details are shown as published, in Portuguese.")).toBeVisible();
    await expect(page).toHaveTitle(/GlobalScholar/);

    await page.goto("/profile");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByLabel("Country of residence")).toHaveAccessibleDescription(/Error: Enter your country of residence/);

    await page.getByRole("button", { name: "Português" }).first().click();
    await expect(page.getByRole("button", { name: "Salvar perfil" })).toBeVisible();
  });
});

test.describe("formulários", () => {
  test("o perfil não perde o que foi digitado ao sair da página sem salvar", async ({ page, api }) => {
    await api.put("/profile", { residence: "Angola", level: "Mestrado" });
    await page.goto("/profile");
    await page.getByLabel("Idiomas e níveis (opcional)").fill("Inglês C1, Francês B1");
    await expect(page.getByText("Há alterações não salvas.")).toBeVisible();

    await page.getByRole("navigation", { name: "Área do estudante" }).getByRole("link", { name: "Bolsas" }).click();
    await expect(page).toHaveURL(/\/scholarships$/);
    await page.getByRole("navigation", { name: "Área do estudante" }).getByRole("link", { name: "Perfil" }).click();

    await expect(page.getByLabel("Idiomas e níveis (opcional)")).toHaveValue("Inglês C1, Francês B1");
    await expect(page.getByText(/Recuperamos o que você tinha digitado/)).toBeVisible();
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByText("Perfil salvo.")).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Recuperamos/)).toHaveCount(0);
  });

  test("login: erros com foco no primeiro campo", async ({ page, api: _api }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByLabel("E-mail")).toBeFocused();
    await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
  });
});

test("upload: valida o arquivo e deixa claro que o envio está desligado", async ({ page, api }) => {
  await api.post("/applications", { scholarshipId: "amostra-005" });
  await page.goto("/applications/amostra-005");
  const input = page.getByLabel("Arquivo para “Carta curta”");
  await input.setInputFiles({ name: "programa.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") });
  await expect(page.getByRole("alert").filter({ hasText: "Tipo de arquivo não aceito" })).toBeVisible();

  await input.setInputFiles({ name: "carta.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 teste") });
  await expect(page.getByText(/carta\.pdf \(\d+ B\) pronto para envio\./)).toBeVisible();
  await expect(page.getByText(/não saiu do seu computador/)).toBeVisible();
});

test("robots.txt e sitemap.xml", async ({ request, api: _api }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain("Disallow: /applications");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain("/scholarships/amostra-001");
  expect(xml.match(/<url>/g)).toHaveLength(9);
});
