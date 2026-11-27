import { ApiError, apiRequest } from "./client";
import { isRecommendations } from "./guards";
import type { ProfileSearch, Recommendations, ReportReason } from "@/types";

/** Recomendações para o estudante logado e relato de erros nas bolsas. */
export interface RecommendationService {
  list(limit?: number, signal?: AbortSignal): Promise<Recommendations>;
  report(scholarshipId: string, reason: ReportReason, message: string): Promise<void>;
  /** "Procurar novas bolsas para mim": começa a busca guiada pelo perfil (roda em segundo plano). */
  search(): Promise<ProfileSearch>;
  /** A busca mais recente deste estudante (ou null). */
  latestSearch(signal?: AbortSignal): Promise<ProfileSearch | null>;
}

const isSearch = (v: unknown): v is ProfileSearch => {
  const r = v as Record<string, unknown> | null;
  return typeof r === "object" && r !== null && typeof r.id === "number" && (r.status === "running" || r.status === "done" || r.status === "failed");
};

const unexpected = () => new ApiError(502, "Resposta inesperada do servidor.", "unexpected_response");

export const apiRecommendationService: RecommendationService = {
  async list(limit = 10, signal) {
    const data = await apiRequest<unknown>(`/recommendations?limit=${limit}`, { signal });
    if (!isRecommendations(data)) throw unexpected();
    return data;
  },
  async report(scholarshipId, reason, message) {
    await apiRequest<void>(`/scholarships/${encodeURIComponent(scholarshipId)}/reports`, { method: "POST", body: { reason, message } });
  },
  async search() {
    const data = await apiRequest<unknown>("/recommendations/search", { method: "POST" });
    if (!isSearch(data)) throw unexpected();
    return data;
  },
  async latestSearch(signal) {
    const data = await apiRequest<{ search?: unknown }>("/recommendations/search", { signal });
    if (data?.search === null) return null;
    if (!isSearch(data?.search)) throw unexpected();
    return data.search;
  }
};
