import type { ApplicationStatus } from "@/types";

export const STUDY_LEVELS = ["Graduação", "Mestrado", "Doutorado", "Curso livre"] as const;

export const APPLICATION_STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: "Saved", label: "Salva" },
  { value: "Preparing", label: "Preparando" },
  { value: "Ready to submit", label: "Pronta para enviar" },
  { value: "Submitted", label: "Enviada (marcada por você)" },
  { value: "Decision received", label: "Resultado recebido" }
];

export function statusLabel(status: ApplicationStatus): string {
  return APPLICATION_STATUSES.find((s) => s.value === status)?.label ?? status;
}
