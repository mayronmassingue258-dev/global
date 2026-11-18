import type { Scholarship } from "@/types";
import data from "./data/scholarships.json";

// DADOS FICTÍCIOS para desenvolvimento visual. Não representam bolsas reais nem verificadas.
// data/scholarships.json é uma cópia das bolsas de demonstração do backend (backend/src/db/seed-data).
export const scholarships = data as Scholarship[];
