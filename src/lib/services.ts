import { DATA_MODE } from "./config";
import { apiScholarshipService, type ScholarshipService } from "./api/scholarships";
import { mockScholarshipService } from "@/mocks/scholarshipService";

/**
 * Ponto único de escolha entre dados reais e dados de demonstração.
 * Produção usa a API real por padrão; mocks só com NEXT_PUBLIC_DATA_MODE=mock.
 * Se a API falhar, o erro é exibido: nunca há troca silenciosa por dados fictícios.
 */
export const scholarshipService: ScholarshipService = DATA_MODE === "mock" ? mockScholarshipService : apiScholarshipService;
