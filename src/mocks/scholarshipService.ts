import type { ScholarshipService } from "@/lib/api/scholarships";
import { eligibilityResults } from "./eligibility";
import { scholarships } from "./scholarships";

// Serviço de DEMONSTRAÇÃO. Só é usado com NEXT_PUBLIC_DATA_MODE=mock.
export const mockScholarshipService: ScholarshipService = {
  async list(query) {
    const text = (query.search ?? "").trim().toLowerCase();
    const country = (query.country ?? "").trim().toLowerCase();
    const filtered = scholarships.filter((item) => {
      const haystack = `${item.title} ${item.institution} ${item.country}`.toLowerCase();
      return (
        (!text || haystack.includes(text)) &&
        (!country || item.country.toLowerCase().includes(country)) &&
        (!query.level || item.level === query.level)
      );
    });
    filtered.sort((a, b) => (query.sort === "title" ? a.title.localeCompare(b.title, "pt-BR") : a.deadline.localeCompare(b.deadline)));
    const size = query.pageSize ?? 10;
    const page = query.page ?? 1;
    return { items: filtered.slice((page - 1) * size, page * size), total: filtered.length };
  },
  async get(id) {
    return scholarships.find((item) => item.id === id) ?? null;
  },
  async eligibility(scholarshipId) {
    return eligibilityResults[scholarshipId] ?? null;
  }
};
