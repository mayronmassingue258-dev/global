import { ApiError, apiRequest } from "./client";
import { isEligibilityResult, isScholarship, isScholarshipPage } from "./guards";
import type { EligibilityResult, Scholarship, ScholarshipPage, ScholarshipQuery } from "@/types";

/** Contrato do serviço. Implementado pelo serviço real (API) e pelo de demonstração (mock). */
export interface ScholarshipService {
  list(query: ScholarshipQuery, signal?: AbortSignal): Promise<ScholarshipPage>;
  get(id: string, signal?: AbortSignal): Promise<Scholarship | null>;
  /** null quando a bolsa não existe ou o visitante não está logado. `headers`: cookie repassado pelo servidor. */
  eligibility(scholarshipId: string, signal?: AbortSignal, headers?: Record<string, string>): Promise<EligibilityResult | null>;
}

const unexpected = () => new ApiError(502, "Resposta inesperada do servidor.", "unexpected_response");

// Caminhos do contrato (docs/api-contract.md), implementados em backend/.
export const apiScholarshipService: ScholarshipService = {
  async list(query, signal) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    const data = await apiRequest<unknown>(`/scholarships?${params}`, { signal });
    if (!isScholarshipPage(data)) throw unexpected();
    return data;
  },

  async get(id, signal) {
    try {
      const data = await apiRequest<unknown>(`/scholarships/${encodeURIComponent(id)}`, { signal });
      if (!isScholarship(data)) throw unexpected();
      return data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async eligibility(scholarshipId, signal, headers) {
    try {
      const data = await apiRequest<unknown>(`/scholarships/${encodeURIComponent(scholarshipId)}/eligibility`, { signal, headers });
      if (!isEligibilityResult(data)) throw unexpected();
      return data;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 401)) return null;
      throw error;
    }
  }
};
