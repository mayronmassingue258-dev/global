import type { DraftService } from "@/lib/api/drafts";
import { ApiError } from "@/lib/api/client";
import { validateDraft } from "@/lib/validation/draft";
import type { Draft } from "@/types";

// DEMONSTRAÇÃO: rascunhos só em memória (somem ao recarregar a página). Nada é gravado no navegador.
let store: Draft[] = [];
let counter = 0;

const check = (input: Parameters<DraftService["create"]>[0]) => {
  const fields = validateDraft(input);
  if (Object.keys(fields).length > 0) throw new ApiError(422, "Alguns campos são inválidos.", "validation_failed", fields as Record<string, string>);
};

export const mockDraftService: DraftService = {
  async list() {
    return [...store].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id) {
    return store.find((d) => d.id === id) ?? null;
  },
  async create(input) {
    check(input);
    const now = new Date().toISOString();
    counter += 1;
    const draft: Draft = { ...input, title: input.title.trim(), program: input.program.trim(), id: `rascunho-${counter}`, createdAt: now, updatedAt: now };
    store = [...store, draft];
    return draft;
  },
  async update(id, input) {
    check(input);
    const current = store.find((d) => d.id === id);
    if (!current) throw new ApiError(404, "Recurso não encontrado.", "not_found");
    const next: Draft = { ...current, ...input, title: input.title.trim(), program: input.program.trim(), updatedAt: new Date().toISOString() };
    store = store.map((d) => (d.id === id ? next : d));
    return next;
  },
  async remove(id) {
    store = store.filter((d) => d.id !== id);
  }
};

/** Só para testes. */
export function __resetMockDrafts() {
  store = [];
  counter = 0;
}
