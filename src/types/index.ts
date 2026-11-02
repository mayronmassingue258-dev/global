// Contratos PROVISÓRIOS. Confirmar o formato real com o backend antes da integração.

export type VerificationStatus = "unverified" | "verified";

export type Scholarship = {
  id: string;
  title: string;
  institution: string;
  country: string;
  level: string;
  /** Rótulo curto do tipo de financiamento (ex.: Integral, Parcial). */
  fundingType: string;
  /** Descrição da cobertura. */
  funding: string;
  /** Data limite no formato AAAA-MM-DD. */
  deadline: string;
  deadlineTimezone?: string;
  summary: string;
  requirements: string[];
  requiredDocuments: string[];
  applicationProcess?: string;
  eligibleCountries?: string[];
  sourceUrl?: string;
  verification: { status: VerificationStatus; verifiedAt?: string };
};

export type ScholarshipSummary = Pick<Scholarship, "id" | "title" | "institution" | "deadline">;

export type ScholarshipSort = "deadline" | "title";

export type ScholarshipQuery = {
  search?: string;
  country?: string;
  level?: string;
  sort?: ScholarshipSort;
  page?: number;
  pageSize?: number;
};

export type ScholarshipPage = { items: Scholarship[]; total: number };

export type ApplicationStatus = "Saved" | "Preparing" | "Ready to submit" | "Submitted" | "Decision received";

export type Application = {
  id: string;
  scholarship: ScholarshipSummary;
  status: ApplicationStatus;
  updatedAt: string;
};

export type EligibilityStatus = "eligible" | "possible" | "not_eligible";

export type EligibilityReason = {
  /** met = critério atendido; missing = falta informação; failed = requisito obrigatório não atendido. */
  kind: "met" | "missing" | "failed";
  text: string;
};

export type EligibilityResult = {
  scholarshipId: string;
  status: EligibilityStatus;
  reasons: EligibilityReason[];
};
