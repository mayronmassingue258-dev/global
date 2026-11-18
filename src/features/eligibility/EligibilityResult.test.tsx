import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { EligibilityResult } from "./EligibilityResult";

describe("EligibilityResult", () => {
  it("mostra o veredito, a nota e cada motivo como frase, com rótulo textual (não só cor)", () => {
    render(
      <EligibilityResult
        result={{
          scholarshipId: "a", status: "possible", score: 68, fit: "medium",
          reasons: [{ kind: "met", code: "nationality_ok" }, { kind: "gap", code: "test_gap", params: { type: "ielts", min: 7, yours: 6.5 } }]
        }}
      />
    );
    expect(screen.getByRole("heading", { name: /Pode ser elegível/ })).toBeInTheDocument();
    expect(screen.getByText("Nota de compatibilidade: 68 de 100")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Falta pouco: IELTS: mínimo 7; a sua nota é 6.5.");
    expect(within(items[1]!).getByText("Cumpre:")).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("A sua nacionalidade é aceita.");
  });

  it("não elegível: sem nota, com o motivo", () => {
    render(<EligibilityResult result={{ scholarshipId: "a", status: "not_eligible", score: 0, fit: "low", reasons: [{ kind: "failed", code: "nationality_not_eligible" }] }} />);
    expect(screen.getByText("Não elegível")).toBeInTheDocument();
    expect(screen.queryByText(/Nota de compatibilidade/)).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Não cumpre: A sua nacionalidade não está entre as aceitas.");
  });
});
