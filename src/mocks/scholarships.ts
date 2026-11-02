import type { Scholarship } from "@/types";
import data from "./data/scholarships.json";

// DADOS FICTÍCIOS para desenvolvimento visual. Não representam bolsas reais nem verificadas.
// A mesma fonte (data/scholarships.json) alimenta o servidor local `npm run mock-api`.
export const scholarships = data as Scholarship[];
