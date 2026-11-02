import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssistantWorkspace } from "./AssistantWorkspace";

describe("AssistantWorkspace", () => {
  it("pede a experiência real antes de criar o roteiro", async () => {
    render(<AssistantWorkspace />);
    await userEvent.click(screen.getByRole("button", { name: "Criar roteiro" }));
    expect(screen.getByRole("status")).toHaveTextContent("Descreva sua experiência real");
    expect(screen.getByLabelText("Conteúdo do rascunho")).toHaveValue("");
  });

  it("monta o roteiro só com o que o estudante escreveu", async () => {
    render(<AssistantWorkspace />);
    await userEvent.click(screen.getByLabelText("Currículo acadêmico"));
    await userEvent.type(screen.getByLabelText("Bolsa ou programa"), "Mestrado X");
    await userEvent.type(screen.getByLabelText("Sua experiência real e seus objetivos"), "Monitor de cálculo por 2 anos.");
    await userEvent.click(screen.getByRole("button", { name: "Criar roteiro" }));
    const draft = screen.getByLabelText<HTMLTextAreaElement>("Conteúdo do rascunho").value;
    expect(draft).toContain("CURRÍCULO ACADÊMICO");
    expect(draft).toContain("Programa: Mestrado X");
    expect(draft).toContain("Monitor de cálculo por 2 anos.");
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum serviço de IA");
  });

  it("copia o rascunho e informa falha de cópia", async () => {
    const user = userEvent.setup();
    render(<AssistantWorkspace />);
    await user.type(screen.getByLabelText("Sua experiência real e seus objetivos"), "Algo real.");
    await user.click(screen.getByRole("button", { name: "Criar roteiro" }));

    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole("button", { name: "Copiar rascunho" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Algo real."));
    expect(screen.getByRole("status")).toHaveTextContent("Rascunho copiado.");

    writeText.mockRejectedValueOnce(new Error("negado"));
    await user.click(screen.getByRole("button", { name: "Copiar rascunho" }));
    expect(screen.getByRole("status")).toHaveTextContent("copie manualmente");
  });
});
