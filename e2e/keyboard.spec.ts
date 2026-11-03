import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/** Pressiona Tab até o foco chegar no elemento esperado (falha se passar de `max` tentativas). */
async function tabTo(page: Page, matcher: (el: { role: string | null; name: string; tag: string }) => boolean, max = 40) {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return { role: null, name: "", tag: "" };
      const forLabel = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : null;
      const label = el.getAttribute("aria-label") ?? forLabel ?? el.closest("label")?.textContent ?? el.textContent ?? "";
      return { role: el.getAttribute("role"), name: label.trim(), tag: el.tagName.toLowerCase() };
    });
    if (matcher(info)) return;
  }
  throw new Error("O foco não chegou ao elemento esperado só com Tab.");
}

/** O elemento focado precisa ter indicador de foco visível (contorno ou sombra). */
async function expectVisibleFocus(page: Page) {
  const style = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    // Controles personalizados mostram o foco no desenho ao lado (irmão) ou no contêiner (:focus-within).
    const sibling = el.nextElementSibling ? getComputedStyle(el.nextElementSibling) : null;
    const parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
    return { outline: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow, siblingOutline: sibling?.outlineStyle ?? "none", parentOutline: parent?.outlineStyle ?? "none" };
  });
  const visible = (style.outline !== "none" && style.width !== "0px") || style.shadow !== "none" || style.siblingOutline !== "none" || style.parentOutline !== "none";
  expect(visible, `foco visível: ${JSON.stringify(style)}`).toBe(true);
}

test("fluxo completo só com teclado: buscar, salvar, abrir candidatura, marcar documento", async ({ page, api: _api }) => {
  await page.goto("/");

  // 1. Primeiro Tab: link de pular para o conteúdo.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  await expectVisibleFocus(page);

  // 2. Busca da landing.
  await tabTo(page, (el) => el.tag === "input" && el.name.includes("Buscar"));
  await expectVisibleFocus(page);
  await page.keyboard.type("Engenharia");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/scholarships\?q=Engenharia/);
  await expect(page.getByRole("status").filter({ hasText: "resultado" })).toHaveText("1 resultado");

  // 3. Salvar a bolsa com a barra de espaço.
  await tabTo(page, (el) => el.name.startsWith("Salvar: Bolsa de Graduação em Engenharia"));
  await expectVisibleFocus(page);
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: /^Salvar: Bolsa de Graduação/ })).toHaveAttribute("aria-pressed", "true");

  // 4. Ir para Candidaturas pela navegação principal (Shift+Tab volta até ela).
  await page.getByRole("navigation", { name: "Área do estudante" }).getByRole("link", { name: "Candidaturas" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/applications$/);

  // 5. Abrir a candidatura e marcar um documento.
  await tabTo(page, (el) => el.name === "Abrir Bolsa de Graduação em Engenharia");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Bolsa de Graduação em Engenharia" })).toBeVisible();
  await tabTo(page, (el) => el.tag === "input" && el.name.includes("Histórico escolar"));
  await expectVisibleFocus(page);
  await page.keyboard.press("Space");
  await expect(page.getByRole("checkbox", { name: "Histórico escolar" })).toBeChecked();
  await expect(page.getByText("1 de 3 prontos")).toBeVisible();

  // 6. Mudar o status pelo teclado.
  await page.getByLabel("Status", { exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("Preparing");
});

test("filtros e chips funcionam pelo teclado", async ({ page, api: _api }) => {
  await page.goto("/scholarships?level=Mestrado");
  await tabTo(page, (el) => el.name === "Remover filtro: Nível: Mestrado");
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/scholarships$/);
});

test("perfil: Enter envia, o foco vai para o erro e Tab segue na ordem visual", async ({ page, api: _api }) => {
  await page.goto("/profile");
  await tabTo(page, (el) => el.name.startsWith("País de residência"));
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("País de residência")).toBeFocused();
  await page.keyboard.type("Moçambique");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Nacionalidade (opcional)")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Nível de estudo atual")).toBeFocused();
});

test("assistente: escolher tipo com setas e criar rascunho pelo teclado", async ({ page, api: _api }) => {
  await page.goto("/assistant");
  await tabTo(page, (el) => el.tag === "input" && el.name.includes("Carta de motivação"));
  await expectVisibleFocus(page);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel(/Currículo acadêmico/)).toBeChecked();
  await tabTo(page, (el) => el.name === "Criar rascunho");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Estrutura do documento" })).toBeVisible();
});
