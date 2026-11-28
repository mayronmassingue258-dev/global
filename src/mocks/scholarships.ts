import type { Scholarship } from "@/types";
import data from "./data/scholarships.json";

// DADOS FICTÍCIOS para desenvolvimento visual. Não representam bolsas reais nem verificadas.
// data/scholarships.json é uma cópia das bolsas de demonstração do backend (backend/src/db/seed-data).
/** Prazo N dias a partir de hoje: as bolsas de demonstração nunca vencem. */
const inDays = (days: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days)).toISOString().slice(0, 10);
};

export const scholarships: Scholarship[] = data.map(({ deadlineInDays, ...rest }) => ({ ...(rest as Omit<Scholarship, "deadline">), deadline: inDays(deadlineInDays) }));
