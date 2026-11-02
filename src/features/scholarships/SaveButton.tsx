"use client";

import { Button } from "@/components/ui/Button";
import type { ScholarshipSummary } from "@/types";
import { useApplications } from "@/features/applications/ApplicationsProvider";
import styles from "./SaveButton.module.css";

/**
 * Rótulo constante + aria-pressed (estado salvo), conforme o padrão de botão de alternância.
 * O nome acessível inclui o título da bolsa para que leitores de tela distingam os botões de uma lista.
 */
export function SaveButton({ scholarship, variant = "tertiary", label = "Salvar" }: { scholarship: ScholarshipSummary; variant?: "tertiary" | "secondary" | "primary"; label?: string }) {
  const { isSaved, save, remove, status } = useApplications();
  const saved = isSaved(scholarship.id);
  const summary: ScholarshipSummary = { id: scholarship.id, title: scholarship.title, institution: scholarship.institution, deadline: scholarship.deadline };
  return (
    <Button
      variant={variant}
      size="sm"
      className={styles.saved}
      aria-pressed={saved}
      aria-label={`${label}: ${scholarship.title}`}
      disabled={status !== "ready"}
      onClick={() => void (saved ? remove(summary.id) : save(summary))}
    >
      {label}
    </Button>
  );
}
