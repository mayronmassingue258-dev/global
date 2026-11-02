import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileChecklist } from "./ProfileChecklist";

describe("ProfileChecklist", () => {
  it("lista pendências primeiro, com rótulo para leitores de tela, e leva ao perfil", () => {
    render(
      <ProfileChecklist
        scholarshipId="a"
        result={{ scholarshipId: "a", status: "possible", reasons: [{ kind: "met", text: "Nível ok." }, { kind: "missing", text: "Falta nota." }, { kind: "missing", text: "Falta idioma." }] }}
      />
    );
    expect(screen.getByText("2 itens pendentes no seu perfil.")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["Falta informar: Falta nota.", "Falta informar: Falta idioma.", "Atendido: Nível ok."]);
    expect(screen.getByRole("link", { name: "Completar perfil" })).toHaveAttribute("href", "/profile");
  });

  it("sem pendências não oferece completar perfil", () => {
    render(<ProfileChecklist scholarshipId="a" result={{ scholarshipId: "a", status: "eligible", reasons: [{ kind: "met", text: "Ok." }] }} />);
    expect(screen.getByText("Nada pendente no seu perfil para esta bolsa.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Completar perfil" })).not.toBeInTheDocument();
  });

  it("sem avaliação mostra aviso discreto", () => {
    render(<ProfileChecklist scholarshipId="a" result={null} />);
    expect(screen.getByText(/não está disponível/)).toBeInTheDocument();
  });
});
