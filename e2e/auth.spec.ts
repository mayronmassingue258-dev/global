import { expect, test, TEST_PASSWORD } from "./fixtures";
import { API_URL } from "../playwright.config";

test.describe("contas", () => {
  test("visitante: área privada leva ao login e volta para onde ia depois de entrar", async ({ page, anonymous: _a, request }) => {
    // Conta criada direto no backend; o navegador do teste continua sem sessão.
    expect((await request.post(`${API_URL}/auth/register`, { data: { name: "Ana", email: "ana@exemplo.com", password: TEST_PASSWORD } })).status()).toBe(201);

    await page.goto("/applications");
    await expect(page).toHaveURL(/\/login\?next=%2Fapplications$/);
    await page.getByLabel("E-mail").fill("ana@exemplo.com");
    await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/applications$/);
    await expect(page.getByRole("banner").getByText("Ana", { exact: true })).toBeVisible();
  });

  test("cadastro pela interface entra direto no painel; sair encerra a sessão", async ({ page, anonymous: _a }) => {
    await page.goto("/register");
    await page.getByLabel("Nome completo").fill("Bia Santos");
    await page.getByLabel("E-mail").fill("bia@exemplo.com");
    await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Criar conta gratuita" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("banner").getByText("Bia Santos", { exact: true })).toBeVisible();

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "gs_session")).toMatchObject({ httpOnly: true, sameSite: "Lax" });

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("main").getByRole("link", { name: "Entrar" })).toBeVisible();
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
  });

  test("login errado não revela se a conta existe e mantém o e-mail digitado", async ({ page, anonymous: _a }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("ninguem@exemplo.com");
    await page.getByLabel("Senha", { exact: true }).fill("qualquer-coisa");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveValue("ninguem@exemplo.com");
    await expect(page.getByLabel("Senha", { exact: true })).toBeFocused();
  });

  test("cadastro com e-mail já usado", async ({ page, api }) => {
    await page.context().clearCookies();
    await page.goto("/register");
    await page.getByLabel("Nome completo").fill("Outra");
    await page.getByLabel("E-mail").fill(api.user.email);
    await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Criar conta gratuita" }).click();
    await expect(page.getByLabel("E-mail")).toHaveAccessibleDescription(/Já existe uma conta com este e-mail/);
  });

  test("esqueci a senha → link no e-mail → nova senha → entra com ela", async ({ page, anonymous: _a, request }) => {
    await request.post(`${API_URL}/auth/register`, { data: { name: "Ana", email: "ana@exemplo.com", password: TEST_PASSWORD } });
    await page.goto("/forgot-password");
    await page.getByLabel("E-mail").fill("ana@exemplo.com");
    await page.getByRole("button", { name: "Enviar instruções" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Se houver uma conta" })).toBeVisible();

    const emails = (await (await request.get(`${API_URL}/__emails`)).json()).items as { to: string; text: string }[];
    const link = emails.at(-1)!.text.match(/http:\/\/localhost:3100\/reset-password\?token=\S+/)![0];
    await page.goto(link);
    await page.getByLabel("Nova senha").fill("nova-senha-forte-1");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Senha alterada" })).toBeVisible();

    await page.goto(link);
    await page.getByLabel("Nova senha").fill("outra-senha-forte-2");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Este link não vale mais" })).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("E-mail").fill("ana@exemplo.com");
    await page.getByLabel("Senha", { exact: true }).fill("nova-senha-forte-1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("cada estudante vê só os próprios dados", async ({ page, api, browser }) => {
    await api.post("/applications", { scholarshipId: "amostra-001" });
    await api.put("/profile", { residence: "Angola", level: "Mestrado" });

    const other = await browser.newContext({ baseURL: "http://localhost:3100" });
    const page2 = await other.newPage();
    expect((await other.request.post("/api/auth/register", { data: { name: "Bia", email: "bia@exemplo.com", password: TEST_PASSWORD } })).status()).toBe(201);
    await page2.goto("/applications");
    await expect(page2.getByText("Nenhuma candidatura ainda")).toBeVisible();
    await page2.goto("/profile");
    await expect(page2.getByLabel("País de residência")).toHaveValue("");
    await page2.goto("/applications/amostra-001");
    await expect(page2.getByText("Candidatura não encontrada")).toBeVisible();
    await other.close();

    await page.goto("/applications");
    await expect(page.getByRole("heading", { level: 2, name: "Bolsa de Mestrado em Ciência de Dados" })).toBeVisible();
  });

  test("visitante na busca: salvar leva ao login; detalhe pede login para o checklist", async ({ page, anonymous: _a }) => {
    await page.goto("/scholarships/amostra-002");
    await expect(page.getByText("Entre na sua conta para ver o que falta")).toBeVisible();
    await page.getByRole("button", { name: /^Salvar bolsa:/ }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fscholarships%2Famostra-002$/);
  });

  test("site não aceita ?next= para outro domínio", async ({ page, anonymous: _a, request }) => {
    await request.post(`${API_URL}/auth/register`, { data: { name: "Ana", email: "ana@exemplo.com", password: TEST_PASSWORD } });
    await page.goto("/login?next=https%3A%2F%2Fmalicioso.example");
    await page.getByLabel("E-mail").fill("ana@exemplo.com");
    await page.getByLabel("Senha", { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/localhost:3100\/dashboard$/);
  });
});
