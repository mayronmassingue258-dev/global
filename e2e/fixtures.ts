import { test as base, expect } from "@playwright/test";
import { API_URL } from "../playwright.config";

/** Cada teste começa com a API local zerada (perfil vazio, nenhuma candidatura). */
export const test = base.extend<{ api: { put: (path: string, body: unknown) => Promise<void>; post: (path: string, body: unknown) => Promise<void> } }>({
  api: async ({ request }, provide) => {
    const reset = await request.post(`${API_URL}/__reset`);
    expect(reset.status()).toBe(204);
    await provide({
      put: async (path, body) => {
        expect((await request.put(`${API_URL}${path}`, { data: body })).ok()).toBe(true);
      },
      post: async (path, body) => {
        expect((await request.post(`${API_URL}${path}`, { data: body })).ok()).toBe(true);
      }
    });
  }
});

export { expect };
