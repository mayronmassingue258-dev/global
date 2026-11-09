import { DATA_MODE } from "./config";
import { apiScholarshipService, type ScholarshipService } from "./api/scholarships";
import { apiApplicationService, type ApplicationService } from "./api/applications";
import { apiProfileService, type ProfileService } from "./api/profile";
import { apiDraftService, type DraftService } from "./api/drafts";
import { apiAuthService, type AuthService } from "./api/auth";
import { mockScholarshipService } from "@/mocks/scholarshipService";
import { mockApplicationService } from "@/mocks/applicationService";
import { mockProfileService } from "@/mocks/profileService";
import { mockDraftService } from "@/mocks/draftService";
import { mockAuthService } from "@/mocks/authService";

/**
 * Ponto único de escolha entre dados reais e dados de demonstração.
 * Produção usa a API real por padrão; mocks só com NEXT_PUBLIC_DATA_MODE=mock.
 * Se a API falhar, o erro é exibido: nunca há troca silenciosa por dados fictícios.
 */
const useMock = DATA_MODE === "mock";

export const scholarshipService: ScholarshipService = useMock ? mockScholarshipService : apiScholarshipService;
export const applicationService: ApplicationService = useMock ? mockApplicationService : apiApplicationService;
export const profileService: ProfileService = useMock ? mockProfileService : apiProfileService;
export const draftService: DraftService = useMock ? mockDraftService : apiDraftService;
export const authService: AuthService = useMock ? mockAuthService : apiAuthService;
