import type { ApplicationStatus } from "@/types";

/** Valores de nível usados pela API (em português). A interface traduz pelo dicionário (`t.levels`). */
export const STUDY_LEVELS = ["Graduação", "Mestrado", "Doutorado", "Curso livre"] as const;

export const APPLICATION_STATUSES: { value: ApplicationStatus }[] = [
  { value: "Saved" },
  { value: "Preparing" },
  { value: "Ready to submit" },
  { value: "Submitted" },
  { value: "Decision received" }
];
