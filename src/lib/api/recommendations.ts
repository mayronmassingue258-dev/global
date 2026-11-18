import { ApiError, apiRequest } from "./client";
import { isRecommendations } from "./guards";
import type { Recommendations, ReportReason } from "@/types";

/** Recomendações para o estudante logado e relato de erros nas bolsas. */
export interface RecommendationService {
  list(limit?: number, signal?: AbortSignal): Promise<Recommendations>;
  report(scholarshipId: string, reason: ReportReason, message: string): Promise<void>;
}

const unexpected = () => new ApiError(502, "Resposta inesperada do servidor.", "unexpected_response");

export const apiRecommendationService: RecommendationService = {
  async list(limit = 10, signal) {
    const data = await apiRequest<unknown>(`/recommendations?limit=${limit}`, { signal });
    if (!isRecommendations(data)) throw unexpected();
    return data;
  },
  async report(scholarshipId, reason, message) {
    await apiRequest<void>(`/scholarships/${encodeURIComponent(scholarshipId)}/reports`, { method: "POST", body: { reason, message } });
  }
};
