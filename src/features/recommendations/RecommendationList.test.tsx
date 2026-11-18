import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionProvider } from "@/features/auth/SessionProvider";
import { ApplicationsProvider } from "@/features/applications/ApplicationsProvider";
import { ApiError } from "@/lib/api/client";
import type { RecommendationService } from "@/lib/api/recommendations";
import { fakeApplicationService, fakeProfileService, makeScholarship } from "@/test/fakes";
import { setupTestRouter } from "@/test/router";
import type { Recommendation, Recommendations } from "@/types";
import { RecommendationList } from "./RecommendationList";

const rec = (id: string, score: number, extra: Partial<Recommendation> = {}): Recommendation => ({
  scholarship: makeScholarship({ id, title: `Bolsa ${id}`, sourceUrl: "https://oficial.example/edital", match: { levels: ["master"], fields: [], eligibleNationalities: [], destinations: ["PT"], coverage: [], languages: [], tests: [], minGpaPercent: null, requiredCompletedLevel: null, maxAge: null, minWorkYears: null, restrictedTo: [], applicationFee: false, studyMode: "onsite" } }),
  eligibility: "eligible", score, fit: score >= 75 ? "high" : "medium", saved: false,
  reasons: [{ kind: "met", code: "nationality_ok" }, { kind: "gap", code: "gpa_gap", params: { min: 70, yours: 65 } }, { kind: "met", code: "field_any" }],
  ...extra
});

function service(data: Recommendations | Error): RecommendationService {
  return { list: () => (data instanceof Error ? Promise.reject(data) : Promise.resolve(data)), report: () => Promise.resolve() };
}

function renderList(recs: RecommendationService, profilePct: Parameters<typeof fakeProfileService>[0] = {}, props: { compact?: boolean } = {}) {
  setupTestRouter("/recommendations");
  return render(
    <SessionProvider user={{ id: "u", email: "a@b.c", name: "Ana" }}>
      <ApplicationsProvider service={fakeApplicationService()}>
        <RecommendationList services={{ recommendations: recs, profile: fakeProfileService(profilePct) }} {...props} />
      </ApplicationsProvider>
    </SessionProvider>
  );
}

describe("RecommendationList", () => {
  it("lista as bolsas na ordem, com nota, motivos, link e aviso de perfil incompleto", async () => {
    renderList(service({ considered: 6, excluded: 3, items: [rec("a", 88), rec("b", 61, { eligibility: "possible" })] }), { nationalities: ["MZ"] });
    const cards = await screen.findAllByRole("listitem", { name: /Bolsa/ });
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByRole("heading", { name: "Bolsa a" })).toBeInTheDocument();
    expect(within(cards[0]!).getByText("Nota de compatibilidade: 88 de 100")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("Compatibilidade alta")).toBeInTheDocument();
    expect(within(cards[0]!).getByText(/Portugal · Mestrado/)).toBeInTheDocument();
    expect(within(cards[1]!).getByText("Pode ser elegível: veja o que falta")).toBeInTheDocument();
    expect(within(cards[0]!).getByText(/Média mínima de 70%/)).toBeInTheDocument();
    expect(within(cards[0]!).getByRole("link", { name: /Edital oficial/ })).toHaveAttribute("href", "https://oficial.example/edital");
    expect(screen.getByText(/2 bolsas recomendadas, de 6 com inscrições abertas \(3 descartadas/)).toBeInTheDocument();
    expect(screen.getByText(/O seu perfil está 8% completo/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Completar perfil" })).toHaveAttribute("href", "/profile");
  });

  it("versão do painel: 2 motivos por bolsa e sem resumo", async () => {
    renderList(service({ considered: 1, excluded: 0, items: [rec("a", 80)] }), {}, { compact: true });
    const card = await screen.findByRole("listitem", { name: /Bolsa a/ });
    expect(within(card).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(/inscrições abertas/)).not.toBeInTheDocument();
  });

  it("nenhuma bolsa: explica e leva à busca", async () => {
    renderList(service({ considered: 4, excluded: 4, items: [] }));
    expect(await screen.findByText("Nenhuma bolsa aberta combina com o seu perfil agora.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar todas as bolsas" })).toHaveAttribute("href", "/scholarships");
  });

  it("falha: mostra erro e tenta de novo", async () => {
    let calls = 0;
    const flaky: RecommendationService = {
      list: () => (++calls === 1 ? Promise.reject(new ApiError(503, "x")) : Promise.resolve({ considered: 1, excluded: 0, items: [rec("a", 70)] })),
      report: () => Promise.resolve()
    };
    renderList(flaky);
    await userEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("heading", { name: "Bolsa a" })).toBeInTheDocument();
  });
});
