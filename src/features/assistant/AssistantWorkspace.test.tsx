import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeDraftService, makeDraft } from "@/test/fakes";
import { setupTestRouter } from "@/test/router";
import { AssistantWorkspace } from "./AssistantWorkspace";

describe("AssistantWorkspace", () => {
  it("sem rascunhos, abre direto a escolha do tipo e cria um rascunho", async () => {
    const nav = setupTestRouter("/assistant");
    const service = fakeDraftService();
    render(<AssistantWorkspace service={service} />);

    expect(await screen.findByRole("heading", { name: "O que você vai escrever?" })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Currículo acadêmico/));
    await userEvent.type(screen.getByLabelText("Bolsa ou programa (opcional)"), "Mestrado X");
    await userEvent.click(screen.getByRole("button", { name: "Criar rascunho" }));

    expect(service.items()[0]).toMatchObject({ type: "academic_cv", title: "Currículo acadêmico — Mestrado X", program: "Mestrado X" });
    expect(nav.current()).toBe(`/assistant?draft=${service.items()[0]!.id}`);
    expect(await screen.findByRole("heading", { name: /Formação/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Estrutura do documento" })).toHaveTextContent("Competências");
  });

  it("?program= da candidatura preenche o novo rascunho", async () => {
    setupTestRouter("/assistant?program=Bolsa%20Y");
    render(<AssistantWorkspace service={fakeDraftService([makeDraft()])} />);
    expect(await screen.findByLabelText("Bolsa ou programa (opcional)")).toHaveValue("Bolsa Y");
  });

  it("abre o rascunho da URL, conta palavras e salva sozinho após uma pausa", async () => {
    setupTestRouter("/assistant?draft=d-1");
    const service = fakeDraftService([makeDraft({ sections: { opening: "Olá banca" } })]);
    render(<AssistantWorkspace service={service} />);

    const opening = await screen.findByRole("textbox", { name: /Abertura/ });
    expect(opening).toHaveValue("Olá banca");
    expect(opening).toHaveAccessibleDescription(/2 palavras · referência 40–90/);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(screen.getByRole("textbox", { name: /Objetivos/ }), "Voltar e ensinar");
    expect(screen.getByText("Alterações não salvas…")).toBeInTheDocument();
    expect(service.updates).toHaveLength(0);

    await act(async () => { vi.advanceTimersByTime(1100); });
    vi.useRealTimers();
    await waitFor(() => expect(service.updates).toHaveLength(1));
    expect(service.updates[0]!.sections).toEqual({ opening: "Olá banca", goals: "Voltar e ensinar" });
    expect(await screen.findByText(/^Salvo ·/)).toBeInTheDocument();

    const outline = screen.getByRole("navigation", { name: "Estrutura do documento" });
    expect(within(outline).getByRole("link", { name: /Objetivos/ })).toHaveTextContent("3");
  });

  it("falha ao salvar mantém o texto e avisa", async () => {
    setupTestRouter("/assistant?draft=d-1");
    const service = fakeDraftService([makeDraft()], { failUpdate: true });
    render(<AssistantWorkspace service={service} />);
    const field = await screen.findByRole("textbox", { name: /Abertura/ });
    await userEvent.type(field, "Texto");
    await userEvent.tab(); // sair do campo salva na hora
    expect(await screen.findByText("Não salvo")).toBeInTheDocument();
    expect(screen.getByText(/Suas alterações continuam na tela/)).toBeInTheDocument();
    expect(field).toHaveValue("Texto");
  });

  it("copia o documento inteiro com títulos de seção", async () => {
    setupTestRouter("/assistant?draft=d-1");
    render(<AssistantWorkspace service={fakeDraftService([makeDraft({ sections: { opening: "Candidato-me." } })])} />);
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValueOnce(undefined);
    await userEvent.click(await screen.findByRole("button", { name: "Copiar documento" }));
    expect(writeText).toHaveBeenCalledWith("Carta para o Mestrado X\n\n\nABERTURA\n\nCandidato-me.");
    expect(screen.getByText("Documento copiado.")).toBeInTheDocument();
  });

  it("excluir pede confirmação e volta para a lista", async () => {
    const nav = setupTestRouter("/assistant?draft=d-1");
    const service = fakeDraftService([makeDraft(), makeDraft({ id: "d-2", title: "Outro" })]);
    render(<AssistantWorkspace service={service} />);
    await userEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(service.items().map((d) => d.id)).toEqual(["d-2"]));
    expect(nav.current()).toBe("/assistant");
    expect(await screen.findByText("Escolha um rascunho")).toBeInTheDocument();
  });

  it("trocar de rascunho pela lista atualiza a URL", async () => {
    const nav = setupTestRouter("/assistant?draft=d-1");
    render(<AssistantWorkspace service={fakeDraftService([makeDraft(), makeDraft({ id: "d-2", title: "Outro" })])} />);
    await userEvent.click(await screen.findByRole("button", { name: /Outro/ }));
    expect(nav.current()).toBe("/assistant?draft=d-2");
    expect(await screen.findByLabelText("Título do rascunho")).toHaveValue("Outro");
  });

  it("erro ao carregar oferece nova tentativa", async () => {
    setupTestRouter("/assistant");
    render(<AssistantWorkspace service={fakeDraftService([], { failList: true })} />);
    expect(await screen.findByText("Não foi possível carregar os rascunhos")).toBeInTheDocument();
  });
});
