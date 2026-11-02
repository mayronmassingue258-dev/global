/** URL pública do site (sem barra no fim). Usada em metadados, sitemap e imagens de compartilhamento. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
export const SITE_NAME = "GlobalScholar";
