import { describe, expect, it } from "vitest";
import { makeScholarship } from "@/test/fakes";
import { jsonLdScript, scholarshipJsonLd } from "./seo";

describe("seo", () => {
  it("monta o JSON-LD só com dados da bolsa", () => {
    const data = scholarshipJsonLd(makeScholarship({ sourceUrl: "https://exemplo.org" }));
    expect(data).toMatchObject({ "@type": "MonetaryGrant", name: "Bolsa de Teste em Física", funder: { name: "Universidade de Teste" }, sameAs: "https://exemplo.org" });
    expect(data.url).toBe("http://localhost:3000/scholarships/s-1");
    expect(scholarshipJsonLd(makeScholarship())).not.toHaveProperty("sameAs");
  });

  it("escapa '<' para não fechar a tag script", () => {
    expect(jsonLdScript({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
