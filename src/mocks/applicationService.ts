import type { ApplicationService } from "@/lib/api/applications";
import { ApiError } from "@/lib/api/client";
import type { Application } from "@/types";

// DEMONSTRAÇÃO: estado só em memória (some ao recarregar a página). Nada é gravado no navegador.
let store: Application[] = [];

export const mockApplicationService: ApplicationService = {
  async list() {
    return [...store];
  },
  async save(scholarship) {
    const existing = store.find((a) => a.id === scholarship.id);
    if (existing) return existing;
    const created: Application = { id: scholarship.id, scholarship, status: "Saved", updatedAt: new Date().toISOString() };
    store = [...store, created];
    return created;
  },
  async update(id, update) {
    const current = store.find((a) => a.id === id);
    if (!current) throw new ApiError(404, "Recurso não encontrado.", "not_found");
    const next: Application = { ...current, ...update, updatedAt: new Date().toISOString() };
    store = store.map((a) => (a.id === id ? next : a));
    return next;
  },
  async remove(id) {
    store = store.filter((a) => a.id !== id);
  }
};

/** Só para testes. */
export function __resetMockApplications() {
  store = [];
}
