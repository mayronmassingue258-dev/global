import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { API_URL } from "../playwright.config";

type Api = {
  put: (path: string, body: unknown) => Promise<void>;
  post: (path: string, body: unknown) => Promise<void>;
  /** Estudante logado neste teste. */
  user: { email: string; password: string; name: string };
};

export const TEST_PASSWORD = "senha-de-teste-123";

/** Zera a base do backend (contas, sessões, dados) e recria as bolsas de demonstração. */
export async function resetBackend(request: APIRequestContext) {
  const reset = await request.post(`${API_URL}/__reset`);
  expect(reset.status()).toBe(204);
}

/**
 * Cada teste começa com a base zerada e um estudante NOVO já logado no navegador do teste.
 * A conta é criada pelo próprio site (/api → backend), então o cookie de sessão fica no navegador,
 * exatamente como acontece com um estudante de verdade. `api.put/post` usam essa mesma sessão.
 */
export const test = base.extend<{ api: Api; anonymous: void }>({
  api: async ({ page, request }, provide) => {
    await resetBackend(request);
    const user = { email: `estudante-${Date.now()}@exemplo.com`, password: TEST_PASSWORD, name: "Estudante Teste" };
    const session = page.context().request;
    const created = await session.post("/api/auth/register", { data: user });
    expect(created.status()).toBe(201);
    await provide({
      user,
      put: async (path, body) => {
        expect((await session.put(`/api${path}`, { data: body })).ok()).toBe(true);
      },
      post: async (path, body) => {
        expect((await session.post(`/api${path}`, { data: body })).ok()).toBe(true);
      }
    });
  },
  /** Para testes de visitante: só zera a base, sem criar conta. */
  anonymous: async ({ request }, provide) => {
    await resetBackend(request);
    await provide();
  }
});

export { expect };
