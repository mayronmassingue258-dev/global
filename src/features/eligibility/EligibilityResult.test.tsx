import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { EligibilityResult } from "./EligibilityResult";

describe("EligibilityResult", () => {
  it("mostra o veredito e cada motivo com rótulo textual (não só cor)", () => {
    render(
      <EligibilityResult
        result={{ scholarshipId: "a", status: "possible", reasons: [{ kind: "met", text: "Nível ok." }, { kind: "missing", text: "Falta nota." }] }}
      />
    );
    expect(screen.getByRole("heading", { name: /Possivelmente elegível/ })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("Atendido")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Falta informar")).toBeInTheDocument();
  });

  it("não elegível", () => {
    render(<EligibilityResult result={{ scholarshipId: "a", status: "not_eligible", reasons: [{ kind: "failed", text: "Sem vínculo." }] }} />);
    expect(screen.getByText("Não elegível")).toBeInTheDocument();
    expect(screen.getByText("Não atendido")).toBeInTheDocument();
  });
});
