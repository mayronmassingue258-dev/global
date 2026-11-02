import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/services", () => ({
  scholarshipService: {
    list: vi.fn(async ({ page }: { page: number }) =>
      page === 1
        ? { items: [{ id: "a b", verification: { status: "verified", verifiedAt: "2026-10-01" } }, { id: "c", verification: { status: "unverified" } }], total: 2 }
        : { items: [], total: 2 }
    )
  }
}));

const { default: sitemap } = await import("./sitemap");
const { default: robots } = await import("./robots");
const { scholarshipService } = await import("@/lib/services");

describe("SEO", () => {
  it("sitemap lista páginas públicas e cada bolsa", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toEqual([
      "http://localhost:3000/",
      "http://localhost:3000/scholarships",
      "http://localhost:3000/register",
      "http://localhost:3000/scholarships/a%20b",
      "http://localhost:3000/scholarships/c"
    ]);
  });

  it("sitemap sobrevive a falha da API", async () => {
    vi.mocked(scholarshipService.list).mockRejectedValueOnce(new Error("offline"));
    expect(await sitemap()).toHaveLength(3);
  });

  it("robots bloqueia a área pessoal e aponta o sitemap", () => {
    const r = robots();
    expect(r.sitemap).toBe("http://localhost:3000/sitemap.xml");
    expect(JSON.stringify(r.rules)).toContain("/applications");
  });
});
