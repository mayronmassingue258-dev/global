import type { Scholarship } from "@/types";
import { SITE_NAME, SITE_URL } from "./site";

/**
 * Dados estruturados (schema.org) da página de uma bolsa. Só usa campos que vieram da API:
 * nada de valores inventados. `MonetaryGrant` é o tipo do schema.org para bolsas/financiamentos.
 */
export function scholarshipJsonLd(item: Scholarship) {
  return {
    "@context": "https://schema.org",
    "@type": "MonetaryGrant",
    name: item.title,
    description: item.summary,
    url: `${SITE_URL}/scholarships/${encodeURIComponent(item.id)}`,
    funder: { "@type": "Organization", name: item.institution },
    ...(item.sourceUrl ? { sameAs: item.sourceUrl } : {}),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL }
  };
}

/** Serializa JSON-LD sem permitir que um texto da API feche a tag <script>. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
