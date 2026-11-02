import { STUDY_LEVELS } from "@/lib/constants";
import type { ScholarshipSort } from "@/types";

export type SearchFilters = { q: string; level: string; country: string; sort: ScholarshipSort };

type ParamsLike = { get(name: string): string | null } | null | undefined;

const MAX = 100;
const clean = (value: string | null | undefined) => (value ?? "").trim().slice(0, MAX);

/** Lê os filtros da URL, ignorando valores desconhecidos (um link editado à mão não quebra a página). */
export function readSearchFilters(params: ParamsLike): SearchFilters {
  const level = clean(params?.get("level"));
  return {
    q: clean(params?.get("q")),
    level: (STUDY_LEVELS as readonly string[]).includes(level) ? level : "",
    country: clean(params?.get("country")),
    sort: params?.get("sort") === "title" ? "title" : "deadline"
  };
}

/** Escreve só o que difere do padrão, em ordem fixa (URLs estáveis e curtas). */
export function writeSearchFilters(filters: SearchFilters): URLSearchParams {
  const out = new URLSearchParams();
  if (filters.q.trim()) out.set("q", filters.q.trim());
  if (filters.level) out.set("level", filters.level);
  if (filters.country.trim()) out.set("country", filters.country.trim());
  if (filters.sort === "title") out.set("sort", "title");
  return out;
}
