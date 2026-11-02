import { ApiError, apiRequest } from "./client";
import { isDraft, isDraftList } from "./guards";
import type { Draft, DraftInput } from "@/types";

/** Rascunhos do assistente de documentos. */
export interface DraftService {
  list(signal?: AbortSignal): Promise<Draft[]>;
  get(id: string, signal?: AbortSignal): Promise<Draft | null>;
  create(input: DraftInput): Promise<Draft>;
  update(id: string, input: DraftInput): Promise<Draft>;
  remove(id: string): Promise<void>;
}

const unexpected = () => new ApiError(502, "Resposta inesperada do servidor.", "unexpected_response");
const path = (id: string) => `/drafts/${encodeURIComponent(id)}`;

// PROVISÓRIO: caminhos descritos em docs/api-contract.md, a confirmar com o backend.
export const apiDraftService: DraftService = {
  async list(signal) {
    const data = await apiRequest<unknown>("/drafts", { signal });
    if (!isDraftList(data)) throw unexpected();
    return data.items;
  },
  async get(id, signal) {
    try {
      const data = await apiRequest<unknown>(path(id), { signal });
      if (!isDraft(data)) throw unexpected();
      return data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  async create(input) {
    const data = await apiRequest<unknown>("/drafts", { method: "POST", body: input });
    if (!isDraft(data)) throw unexpected();
    return data;
  },
  async update(id, input) {
    const data = await apiRequest<unknown>(path(id), { method: "PUT", body: input });
    if (!isDraft(data)) throw unexpected();
    return data;
  },
  async remove(id) {
    try {
      await apiRequest<void>(path(id), { method: "DELETE" });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return;
      throw error;
    }
  }
};
