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

/** Perfil acadêmico do estudante. Strings vazias significam "não informado". */
export type Profile = {
  residence: string;
  nationality: string;
  level: string;
  field: string;
  grade: string;
  languages: string;
  interests: string;
  updatedAt?: string;
};

export type ProfileInput = Omit<Profile, "updatedAt">;

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

/** Estudante autenticado (dados públicos da conta). */
export type User = { id: string; email: string; name: string };
