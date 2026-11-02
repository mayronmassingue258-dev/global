import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Páginas públicas podem ser indexadas; a área pessoal do estudante não. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/scholarships"], disallow: ["/dashboard", "/applications", "/profile", "/assistant", "/eligibility"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
