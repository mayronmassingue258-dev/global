import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/** Painel de administração e busca de bolsas, num navegador real, contra o backend real. */

test.describe("painel de administração", () => {
  test("estudante comum não acessa; admin vê o menu, a busca e todas as bolsas", async ({ page, api }) => {
    await page.goto("/admin");
    await expect(page.getByText("Esta área é só para administradores.")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Área do estudante" }).getByRole("link", { name: "Admin" })).toHaveCount(0);

    await api.makeAdmin();
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Área do estudante" }).getByRole("link", { name: "Admin" })).toBeVisible();
    // Nos testes não há chave do Gemini: o painel explica o que falta, em vez de quebrar.
    await expect(page.getByText(/Falta configurar a chave GEMINI_API_KEY no Render/)).toBeVisible();
    await expect(page.getByText("6 bolsas")).toBeVisible();
  });

  test("verificar, ocultar e pôr no ar refletem na busca pública", async ({ page, api, browser }) => {
    await api.makeAdmin();
    await page.goto("/admin");
    const row = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Bolsa de Mestrado em Ciência de Dados" }) });
    await row.getByRole("button", { name: "Marcar como verificada" }).click();
    await expect(row.getByRole("button", { name: "Desmarcar verificação" })).toBeVisible();
    await expect(row.getByText("Verificada", { exact: true })).toBeVisible();

    await row.getByRole("button", { name: "Ocultar" }).click();
    await expect(row.getByText(/^Oculta/)).toBeVisible();
    const visitor = await browser.newContext({ baseURL: "http://localhost:3100" });
    const other = await visitor.newPage();
    await other.goto("/scholarships");
    await expect(other.getByRole("heading", { name: "Bolsa de Mestrado em Ciência de Dados" })).toHaveCount(0);

    await row.getByRole("button", { name: "Pôr no ar" }).click();
    await expect(row.getByText("No ar", { exact: true })).toBeVisible();
    await other.reload();
    await expect(other.getByRole("heading", { name: "Bolsa de Mestrado em Ciência de Dados" })).toBeVisible();
    await visitor.close();
  });

  test("relato de um estudante aparece para o admin e pode ser resolvido", async ({ page, api }) => {
    await page.goto("/scholarships/amostra-005");
    await page.getByRole("button", { name: "Reportar erro nesta bolsa" }).click();
    await page.getByLabel("O link do edital não funciona").check();
    await page.getByLabel(/Detalhes/).fill("Dá página não encontrada.");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Obrigado! A equipe vai conferir.")).toBeVisible();

    await api.makeAdmin();
    await page.goto("/admin");
    await page.getByLabel("Só reportadas").check();
    const row = page.getByRole("listitem").filter({ hasText: "1 relato" });
    await expect(row.getByRole("heading", { name: "Bolsa de Idiomas e Cultura" })).toBeVisible();
    await row.getByRole("button", { name: "Ver relatos" }).click();
    await expect(row.getByText("Dá página não encontrada.")).toBeVisible();
    await row.getByRole("button", { name: "Marcar relatos como resolvidos" }).click();
    await expect(page.getByText("Nenhuma bolsa com estes filtros.")).toBeVisible();
  });

  test("cadastrar uma bolsa nova em JSON e ela aparece no site", async ({ page, api }) => {
    await api.makeAdmin();
    await page.goto("/admin");
    await page.getByRole("button", { name: "Nova bolsa (JSON)" }).click();
    await page.getByLabel("Id (letras minúsculas, números e hífen)").fill("bolsa-teste-e2e");
    const box = page.getByLabel("Bolsa no formato do importador");
    const template = JSON.parse(await box.inputValue());
    const deadline = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await box.fill(JSON.stringify({
      ...template, title: "Bolsa Teste E2E", institution: "Universidade de Teste", country: "Portugal", funding: "Propinas.",
      deadline, summary: "Criada pelo teste.", sourceUrl: "https://exemplo.org/edital",
      requiredDocuments: ["Declaração 100% / certificado"]
    }, null, 2));
    await page.getByRole("button", { name: "Salvar bolsa" }).click();
    await expect(page.getByRole("heading", { name: "Bolsa Teste E2E" })).toBeVisible();
    await page.goto("/scholarships/bolsa-teste-e2e");
    await expect(page.getByRole("heading", { level: 1, name: "Bolsa Teste E2E" })).toBeVisible();

    // Documento com %, barra e acento no nome: salvar, anexar pelo site (repasse /api) e baixar idêntico.
    await page.getByRole("button", { name: /^Salvar bolsa:/ }).click();
    await page.goto("/applications/bolsa-teste-e2e");
    const content = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(500, 0x20)]);
    await page.getByLabel("Arquivo para “Declaração 100% / certificado”").setInputFiles({ name: "declaracao.pdf", mimeType: "application/pdf", buffer: content });
    await expect(page.getByRole("link", { name: /^Baixar declaracao\.pdf/ })).toBeVisible();
    await page.reload();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: /^Baixar declaracao\.pdf/ }).click();
    const { readFile } = await import("node:fs/promises");
    expect((await readFile((await (await download).path())!)).equals(content)).toBe(true);
  });

  test("acessibilidade do painel com relatos e editor abertos", async ({ page, api }) => {
    await api.makeAdmin();
    await page.goto("/admin");
    await page.getByRole("button", { name: "Ver relatos" }).first().click();
    await page.getByRole("button", { name: "Editar (JSON)" }).first().click();
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.length}× ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
  });
});

test.describe("procurar novas bolsas (estudante)", () => {
  test("perfil incompleto pede para completar; sem chave configurada explica que não está disponível", async ({ page, api }) => {
    await page.goto("/recommendations");
    const box = page.getByRole("region", { name: "Não achou o que procura?" });
    await box.getByRole("button", { name: "Procurar novas bolsas para mim" }).click();
    await expect(box.getByRole("alert")).toContainText("Complete o perfil");
    await expect(box.getByRole("alert").getByRole("link", { name: "Completar perfil" })).toHaveAttribute("href", "/profile");

    await api.put("/profile", { nationalities: ["MZ"], targetLevels: ["master"] });
    await page.reload();
    await box.getByRole("button", { name: "Procurar novas bolsas para mim" }).click();
    await expect(box.getByRole("alert")).toContainText("A busca não está disponível agora.");
  });
});
