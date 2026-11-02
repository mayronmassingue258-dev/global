import { ApiError, apiRequest } from "./client";
import { isApplication, isApplicationList } from "./guards";
import type { Application, ApplicationUpdate, ScholarshipSummary } from "@/types";

/** Candidaturas acompanhadas pelo estudante. "Enviada" é só uma marcação; nada é submetido ao provedor. */
export interface ApplicationService {
  list(signal?: AbortSignal): Promise<Application[]>;
  /** Idempotente: salvar uma bolsa já salva devolve o registro existente. */
  save(scholarship: ScholarshipSummary): Promise<Application>;
  update(id: string, update: ApplicationUpdate): Promise<Application>;
  remove(id: string): Promise<void>;
}

const unexpected = () => new ApiError(502, "Resposta inesperada do servidor.", "unexpected_response");

// PROVISÓRIO: caminhos descritos em docs/api-contract.md, a confirmar com o backend.
export const apiApplicationService: ApplicationService = {
  async list(signal) {
    const data = await apiRequest<unknown>("/applications", { signal });
    if (!isApplicationList(data)) throw unexpected();
    return data.items;
  },
  async save(scholarship) {
    const data = await apiRequest<unknown>("/applications", { method: "POST", body: { scholarshipId: scholarship.id } });
    if (!isApplication(data)) throw unexpected();
    return data;
  },
  async update(id, update) {
    const data = await apiRequest<unknown>(`/applications/${encodeURIComponent(id)}`, { method: "PATCH", body: update });
    if (!isApplication(data)) throw unexpected();
    return data;
  },
  async remove(id) {
    try {
      await apiRequest<void>(`/applications/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (error) {
      // Já removida: o resultado desejado foi atingido.
      if (error instanceof ApiError && error.status === 404) return;
      throw error;
    }
  }
};
