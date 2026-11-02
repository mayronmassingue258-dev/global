import type { MetadataRoute } from "next";
import { scholarshipService } from "@/lib/services";
import { SITE_URL } from "@/lib/site";

// Gerado a cada pedido: no build a API ainda não está disponível.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const MAX_PAGES = 20; // até 1000 bolsas; acima disso, dividir em vários sitemaps

/** Páginas públicas + uma entrada por bolsa. Se a API falhar, entrega pelo menos as páginas fixas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/scholarships`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/register`, changeFrequency: "yearly", priority: 0.3 }
  ];
  try {
    const entries: MetadataRoute.Sitemap = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { items, total } = await scholarshipService.list({ sort: "deadline", page, pageSize: PAGE_SIZE });
      for (const item of items) {
        entries.push({
          url: `${SITE_URL}/scholarships/${encodeURIComponent(item.id)}`,
          changeFrequency: "weekly",
          priority: 0.7,
          ...(item.verification.verifiedAt ? { lastModified: item.verification.verifiedAt } : {})
        });
      }
      if (page * PAGE_SIZE >= total) break;
    }
    return [...fixed, ...entries];
  } catch {
    return fixed;
  }
}
