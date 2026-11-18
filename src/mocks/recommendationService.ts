import type { RecommendationService } from "@/lib/api/recommendations";
import { mockApplicationService } from "./applicationService";
import { mockRecommendations } from "./eligibility";

// DEMONSTRAÇÃO: recomendações fictícias e relatos que não vão a lugar nenhum.
export const mockRecommendationService: RecommendationService = {
  async list(limit = 10) {
    const saved = new Set((await mockApplicationService.list()).map((a) => a.id));
    const all = mockRecommendations(saved);
    return { considered: 6, excluded: 6 - all.length, items: all.slice(0, limit) };
  },
  async report() {
    // nada a fazer na demonstração
  }
};
