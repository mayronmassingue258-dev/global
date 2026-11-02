import { ApiError, apiRequest } from "./client";
import { isEligibilityResult, isScholarship, isScholarshipPage } from "./guards";
import type { EligibilityResult, Scholarship, ScholarshipPage, ScholarshipQuery } from "@/types";

/** Contrato do serviço. Implementado pelo serviço real (API) e pelo de demonstração (mock). */
export interface ScholarshipService {
  list(query: ScholarshipQuery, signal?: AbortSignal): Promise<ScholarshipPage>;
  get(id: string, signal?: AbortSignal): Promise<Scholarship | null>;
  eligibility(scholarshipId: string, signal?: AbortSignal): Promise<EligibilityResult | null>;
}

const unexpected = () => new ApiError(502, "Resposta inesperada do servidor.");

// PROVISÓRIO: os caminhos abaixo NÃO estão confirmados. Ajustar quando o contrato do backend existir.
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

  async eligibility(scholarshipId, signal) {
    try {
      const data = await apiRequest<unknown>(`/scholarships/${encodeURIComponent(scholarshipId)}/eligibility`, { signal });
      if (!isEligibilityResult(data)) throw unexpected();
      return data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }
};
