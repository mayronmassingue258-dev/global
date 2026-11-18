import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileChecklist } from "./ProfileChecklist";

describe("ProfileChecklist", () => {
  it("mostra a nota, lista pendências primeiro (como frases) e leva ao perfil", () => {
    render(
      <ProfileChecklist
        scholarshipId="a"
        result={{
          scholarshipId: "a", status: "possible", score: 61, fit: "medium",
          reasons: [{ kind: "met", code: "level_ok", params: { levels: ["master"] } }, { kind: "missing", code: "gpa_missing", params: { min: 70 } }, { kind: "gap", code: "language_gap", params: { code: "en", min: "C1", yours: "B2" } }]
        }}
      />
    );
    expect(screen.getByText("Compatibilidade média")).toBeInTheDocument();
    expect(screen.getByText("2 pontos a resolver.")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      "Falta pouco: Inglês: pede C1; você indicou B2 (independente).",
      "Falta informar: Média mínima de 70%. Informe a sua média e a escala.",
      "Cumpre: Financia o nível que você procura: Mestrado."
    ]);
    expect(screen.getByRole("link", { name: "Completar perfil" })).toHaveAttribute("href", "/profile");
  });

  it("sem pendências não oferece completar perfil", () => {
    render(<ProfileChecklist scholarshipId="a" result={{ scholarshipId: "a", status: "eligible", score: 90, fit: "high", reasons: [{ kind: "met", code: "field_any" }] }} />);
    expect(screen.getByText("Nada pendente no seu perfil para esta bolsa.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Completar perfil" })).not.toBeInTheDocument();
  });

  it("não elegível: explica em vez de mostrar nota", () => {
    render(<ProfileChecklist scholarshipId="a" result={{ scholarshipId: "a", status: "not_eligible", score: 0, fit: "low", reasons: [{ kind: "failed", code: "age_failed", params: { max: 30 } }] }} />);
    expect(screen.getByText(/você não pode se candidatar/)).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Idade máxima: 30 anos.");
  });

  it("sem avaliação mostra aviso discreto", () => {
    render(<ProfileChecklist scholarshipId="a" result={null} />);
    expect(screen.getByText(/não está disponível/)).toBeInTheDocument();
  });
});
