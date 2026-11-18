import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RecommendationService } from "@/lib/api/recommendations";
import { ReportProblem } from "./ReportProblem";

const service = (fail = false) => {
  const report = vi.fn(() => (fail ? Promise.reject(new Error("x")) : Promise.resolve()));
  return { list: vi.fn(), report } as unknown as RecommendationService & { report: typeof report };
};

describe("ReportProblem", () => {
  it("abre, exige um motivo e envia", async () => {
    const s = service();
    render(<ReportProblem scholarshipId="b-1" signedIn service={s} />);
    const toggle = screen.getByRole("button", { name: "Reportar erro nesta bolsa" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByRole("group", { name: "O que está errado?" })).toHaveAttribute("aria-invalid", "true");
    expect(s.report).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText("O prazo está errado"));
    await userEvent.type(screen.getByLabelText(/Detalhes/), "  é 15 de março  ");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Obrigado! A equipe vai conferir.")).toBeInTheDocument();
    expect(s.report).toHaveBeenCalledWith("b-1", "wrong_deadline", "é 15 de março");
  });

  it("falha avisa; sem login pede para entrar", async () => {
    const { unmount } = render(<ReportProblem scholarshipId="b-1" signedIn service={service(true)} />);
    await userEvent.click(screen.getByRole("button", { name: "Reportar erro nesta bolsa" }));
    await userEvent.click(screen.getByLabelText("Parece golpe ou cobra para se candidatar sem ser oficial"));
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível enviar");
    unmount();

    render(<ReportProblem scholarshipId="b-1" signedIn={false} service={service()} />);
    await userEvent.click(screen.getByRole("button", { name: "Reportar erro nesta bolsa" }));
    expect(screen.getByRole("link", { name: /Entre na sua conta/ })).toHaveAttribute("href", "/login?next=%2Fscholarships%2Fb-1");
  });
});
