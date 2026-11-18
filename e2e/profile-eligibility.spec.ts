import { expect, test } from "./fixtures";

/** Perfil de uma estudante moçambicana que quer mestrado e precisa de bolsa integral. */
const MOZAMBICAN = {
  nationalities: ["MZ"], residenceCountry: "MZ", completedLevel: "bachelor", targetLevels: ["master"], fields: ["computer_science"],
  gpa: { value: 16, scale: "20" }, languages: [{ code: "pt", level: "native" }, { code: "en", level: "C1" }], tests: [{ type: "ielts", score: 7 }],
  fundingNeed: "full", canPayApplicationFee: false, birthYear: 2000, workYears: 1, studyMode: "onsite", startYear: new Date().getFullYear() + 1
};

test.describe("perfil em etapas", () => {
  test("preenche as etapas, salva a cada passo e termina nas bolsas recomendadas", async ({ page, api: _api }) => {
    await page.goto("/profile");
    await expect(page.getByText("Perfil 0% completo")).toBeVisible();

    // 1 · Origem
    await page.getByRole("combobox", { name: "Nacionalidade(s)" }).selectOption("MZ");
    await page.getByLabel("País onde mora hoje").selectOption("MZ");
    await page.getByLabel("Ano de nascimento").fill("2000");
    await page.getByRole("button", { name: "Salvar e continuar" }).click();
    await expect(page.getByRole("heading", { name: "O que você já estudou" })).toBeFocused();
    await expect(page.getByText("Perfil 25% completo")).toBeVisible();

    // 2 · Formação (nota com vírgula, na escala de 0 a 20)
    await page.getByLabel("Maior nível que você já concluiu").selectOption("bachelor");
    await page.getByLabel("Informática e ciência de dados").check();
    await page.getByLabel("Média final").fill("15,5");
    await page.getByLabel("Escala da nota").selectOption("20");
    await page.getByRole("button", { name: "Salvar e continuar" }).click();

    // 3 · Idiomas
    await page.getByRole("button", { name: "Adicionar idioma" }).click();
    await page.getByRole("button", { name: "Adicionar idioma" }).click();
    await page.getByLabel("Nível").nth(1).selectOption("C1");
    await page.getByRole("button", { name: "Salvar e continuar" }).click();

    // 4 · Experiência → 5 · Objetivos
    await page.getByLabel("Anos de experiência profissional").fill("1");
    await page.getByRole("button", { name: "Salvar e continuar" }).click();
    await page.getByLabel("Mestrado").check();
    await page.getByLabel("Presencial, no exterior").check();
    await page.getByRole("button", { name: "Salvar e continuar" }).click();

    // 6 · Finanças → recomendações
    await page.getByLabel("Preciso de bolsa integral (propinas e sustento)").check();
    await page.getByRole("button", { name: "Salvar e ver bolsas para mim" }).click();
    await expect(page).toHaveURL(/\/recommendations$/);
    await expect(page.getByRole("heading", { level: 1, name: "As bolsas que mais combinam com você." })).toBeVisible();

    // Recarregar o perfil mostra o que foi salvo.
    await page.goto("/profile");
    await expect(page.getByText("Perfil 92% completo")).toBeVisible();
    await expect(page.getByRole("list", { name: "Escolhidos em Nacionalidade(s)" })).toContainText("Moçambique");
  });

  test("nota acima da escala: erro no campo, foco nele e nada salvo", async ({ page, api: _api }) => {
    await page.goto("/profile");
    await page.getByRole("navigation", { name: "Etapas do perfil" }).getByRole("button", { name: /Formação/ }).click();
    await page.getByLabel("Média final").fill("25");
    await page.getByLabel("Escala da nota").selectOption("20");
    await page.getByRole("button", { name: "Salvar e continuar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Corrija os campos" })).toBeVisible();
    await expect(page.getByLabel("Média final")).toBeFocused();
    await expect(page.getByLabel("Média final")).toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("recomendações e elegibilidade", () => {
  test("o perfil muda a elegibilidade e as recomendações calculadas pelo servidor", async ({ page, api }) => {
    const main = page.getByRole("main");
    await page.goto("/eligibility/amostra-004");
    await expect(main.getByText("Falta pouco", { exact: true })).toBeVisible();

    await api.put("/profile", MOZAMBICAN);
    await page.reload();
    await expect(main.getByText("Não elegível", { exact: true })).toBeVisible();
    await expect(main.getByText("A sua nacionalidade não está entre as aceitas.")).toBeVisible();

    await page.goto("/eligibility/amostra-001");
    await expect(main.getByText("Elegível", { exact: true })).toBeVisible();
    await expect(main.getByText("Compatibilidade alta")).toBeVisible();
    await expect(main.getByText(/não garante aprovação/)).toBeVisible();

    await page.goto("/recommendations");
    const cards = main.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2 }) });
    await expect(cards.first().getByRole("heading", { name: "Bolsa de Mestrado em Ciência de Dados" })).toBeVisible();
    await expect(main.getByRole("heading", { name: /Intercâmbio de Pesquisa em Biotecnologia/ })).toHaveCount(0);
    await expect(main.getByText(/descartadas? por um requisito/)).toBeVisible();
  });

  test("painel mostra as recomendadas e leva à lista completa", async ({ page, api }) => {
    await api.put("/profile", MOZAMBICAN);
    await page.goto("/dashboard");
    const section = page.getByRole("region", { name: "Recomendadas para você" });
    await expect(section.getByRole("heading", { name: "Bolsa de Mestrado em Ciência de Dados" })).toBeVisible();
    await section.getByRole("link", { name: "Ver todas" }).click();
    await expect(page).toHaveURL(/\/recommendations$/);
  });
});

test("detalhe da bolsa: quem pode se candidatar, nota e reportar erro", async ({ page, api }) => {
  await page.goto("/scholarships/amostra-001");
  const main = page.getByRole("main");
  await expect(main.getByText("Bolsa FICTÍCIA de demonstração: não se candidate.")).toBeVisible();
  const who = main.getByRole("region", { name: "Quem pode se candidatar" });
  await expect(who.getByText("Mestrado")).toBeVisible();
  await expect(who.getByText(/países da Commonwealth/)).toBeVisible();
  await expect(who.getByText(/IELTS 6.5/)).toBeVisible();

  const aside = page.getByRole("complementary", { name: "Resumo e próximos passos" });
  await expect(aside.getByText("Informe a sua nacionalidade para sabermos se é aceita.")).toBeVisible();
  await api.put("/profile", MOZAMBICAN);
  await page.reload();
  await expect(aside.getByText("Compatibilidade alta")).toBeVisible();
  await expect(aside.getByRole("link", { name: "Completar perfil" })).toHaveCount(0);

  await main.getByRole("button", { name: "Reportar erro nesta bolsa" }).click();
  await main.getByLabel("O prazo está errado").check();
  await main.getByLabel(/Detalhes/).fill("O edital diz 15 de março.");
  await main.getByRole("button", { name: "Enviar" }).click();
  await expect(main.getByText("Obrigado! A equipe vai conferir.")).toBeVisible();
});
