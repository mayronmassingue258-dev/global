// Contratos com o backend (docs/api-contract.md). Validados em tempo de execução em src/lib/api/guards.ts.
import type {
  CompletedLevel, CountryCode, Coverage, Experience, FieldCode, FundingNeed, GpaScale, Group, LanguageCode, LanguageLevel,
  ScholarshipMode, StudyMode, TargetLevel, TestType
} from "@/lib/matching";

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
  sourceUrl?: string;
  /** Critérios de compatibilidade (quem pode se candidatar, o que cobre, idiomas…). */
  match?: ScholarshipMatch;
  /** "hidden": fora do ar (prazo vencido, link quebrado, reportada). Só aparece para quem já salvou. */
  status?: "active" | "hidden";
  /** "demo" = fictícia; "discovery" = encontrada pela busca automática; "manual" = cadastrada por um admin. */
  origin?: "manual" | "discovery" | "demo";
  lastCheckedAt?: string;
  verification: { status: VerificationStatus; verifiedAt?: string };
};

export type ScholarshipMatch = {
  levels: TargetLevel[];
  /** Vazio = qualquer área. */
  fields: FieldCode[];
  /** Códigos ISO ou grupos (@AFRICA, @CPLP, @COMMONWEALTH). Vazio = qualquer nacionalidade. */
  eligibleNationalities: string[];
  destinations: string[];
  coverage: Coverage[];
  languages: { code: LanguageCode; minLevel: LanguageLevel }[];
  /** Basta um. */
  tests: { type: TestType; minScore: number }[];
  minGpaPercent: number | null;
  requiredCompletedLevel: CompletedLevel | null;
  maxAge: number | null;
  minWorkYears: number | null;
  restrictedTo: Group[];
  applicationFee: boolean;
  studyMode: ScholarshipMode;
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

/** Arquivo anexado a um item do checklist (metadados; o conteúdo é baixado à parte). */
export type AttachedFile = { name: string; size: number; type: string; uploadedAt: string };

export type ApplicationDocument = { name: string; done: boolean; file?: AttachedFile };

/** Evento da linha do tempo de uma candidatura (registrado pelo servidor). */
export type TimelineEvent =
  | { at: string; kind: "created" }
  | { at: string; kind: "status"; status: ApplicationStatus }
  | { at: string; kind: "document"; document: string; done: boolean }
  | { at: string; kind: "notes" };

export type Application = {
  id: string;
  scholarship: ScholarshipSummary;
  status: ApplicationStatus;
  /** Checklist criado a partir de `requiredDocuments` da bolsa. */
  documents: ApplicationDocument[];
  notes: string;
  timeline: TimelineEvent[];
  updatedAt: string;
};

export type EligibilityStatus = "eligible" | "possible" | "not_eligible";

/**
 * Motivo da avaliação, em CÓDIGO (o site escreve a frase em PT/EN: src/features/matching/reasons.ts).
 * failed = requisito obrigatório não cumprido; gap = cumpre em parte (dá para resolver); missing = falta informar; met = cumpre; info = aviso.
 */
export type Reason = { kind: "met" | "gap" | "missing" | "failed" | "info"; code: string; params?: Record<string, string | number | string[]> };

export type Fit = "high" | "medium" | "low";

export type EligibilityResult = {
  scholarshipId: string;
  status: EligibilityStatus;
  /** 0–100 (0 quando não elegível). */
  score: number;
  fit: Fit;
  reasons: Reason[];
};

export type Recommendation = {
  scholarship: Scholarship;
  eligibility: "eligible" | "possible";
  score: number;
  fit: Fit;
  reasons: Reason[];
  saved: boolean;
};

export type Recommendations = { considered: number; excluded: number; items: Recommendation[] };

/** Perfil do estudante. Listas vazias, "" e null significam "não informado". */
export type ProfileInput = {
  nationalities: CountryCode[];
  residenceCountry: CountryCode | "";
  completedLevel: CompletedLevel | "";
  targetLevels: TargetLevel[];
  fields: FieldCode[];
  fieldDetail: string;
  gpa: { value: number; scale: GpaScale } | null;
  graduationYear: number | null;
  languages: { code: LanguageCode; level: LanguageLevel }[];
  tests: { type: TestType; score: number }[];
  workYears: number | null;
  experience: Experience[];
  birthYear: number | null;
  groups: Group[];
  fundingNeed: FundingNeed | "";
  needsCoverage: Coverage[];
  canPayApplicationFee: boolean | null;
  destinations: CountryCode[];
  excludedDestinations: CountryCode[];
  studyMode: StudyMode | "";
  startYear: number | null;
  goals: string;
};

export type Profile = ProfileInput & {
  /** Calculada pelo servidor: % dos itens que mais pesam nas recomendações, e quais faltam. */
  completeness: { percent: number; missing: string[] };
  updatedAt?: string;
};

export type ReportReason = "broken_link" | "wrong_deadline" | "wrong_info" | "closed" | "scam" | "other";

/** Bolsa vista no painel de administração. */
export type AdminScholarship = Scholarship & { openReports: number; hiddenReason?: string };

export type AdminReport = { id: number; reason: ReportReason; message: string; createdAt: string; resolvedAt?: string; reporter?: string };

/** Atualização parcial: envie só o que mudou. Em `documents`, só os itens alterados (pelo nome). */
export type ApplicationUpdate = { status?: ApplicationStatus; notes?: string; documents?: ApplicationDocument[] };

export type DocumentType = "motivation_letter" | "academic_cv" | "personal_statement" | "document_review";

/** Rascunho do assistente de documentos. `sections` mapeia a chave da seção para o texto. */
export type Draft = {
  id: string;
  type: DocumentType;
  title: string;
  program: string;
  sections: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type DraftInput = Pick<Draft, "type" | "title" | "program" | "sections">;

/** Estudante autenticado (dados públicos da conta). `role` só existe em contas de administração. */
export type User = { id: string; email: string; name: string; role?: "admin" };

/** Execução da busca automática de bolsas (painel de administração). */
export type DiscoveryRun = {
  id: number;
  status: "running" | "done" | "failed";
  dryRun: boolean;
  provider: string;
  sources: string[];
  startedAt: string;
  finishedAt?: string;
  summary?: { created?: number; updated?: number; skipped?: number; requests?: number; costUsd?: number; stoppedForBudget?: boolean; problems?: string[] };
  log?: string;
};

export type DiscoveryState = {
  provider: string;
  configured: boolean;
  sources: { id: string; name: string }[];
  weekSources: string[];
  items: DiscoveryRun[];
};

/** Busca guiada pelo perfil ("Procurar novas bolsas para mim"). */
export type ProfileSearch = { id: number; status: "running" | "done" | "failed"; startedAt?: string; finishedAt?: string; summary?: { created: number; updated: number } };
