import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeApplicationService, makeApplication } from "@/test/fakes";
import { setupTestRouter } from "@/test/router";
import { ApplicationsProvider } from "./ApplicationsProvider";
import { ApplicationDetail } from "./ApplicationDetail";
import { MutationErrorNotice } from "./MutationErrorNotice";

function renderDetail(service = fakeApplicationService([makeApplication()]), id = "s-1") {
  return { service, ...render(<ApplicationsProvider service={service}><MutationErrorNotice /><ApplicationDetail id={id} /></ApplicationsProvider>) };
}

describe("ApplicationDetail", () => {
  it("mostra título, prazo, checklist com progresso e linha do tempo", async () => {
    renderDetail();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando candidatura");
    expect(await screen.findByRole("heading", { level: 1, name: "Bolsa de Teste em Física" })).toBeInTheDocument();
    expect(screen.getByText("1 de 2 prontos")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Histórico" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Diploma" })).not.toBeChecked();
    expect(screen.getByText("Bolsa salva para acompanhamento")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Escrever um documento para esta bolsa" })).toHaveAttribute("href", "/assistant?program=Bolsa%20de%20Teste%20em%20F%C3%ADsica");
  });

  it("marcar documento atualiza progresso, servidor e linha do tempo", async () => {
    const { service } = renderDetail();
    await userEvent.click(await screen.findByRole("checkbox", { name: "Diploma" }));
    expect(screen.getByText("2 de 2 prontos")).toBeInTheDocument();
    expect(service.items()[0]!.documents.every((d) => d.done)).toBe(true);
    const timeline = screen.getByRole("heading", { name: "Linha do tempo" }).parentElement!;
    expect(within(timeline).getByText("Documento pronto: Diploma")).toBeInTheDocument();
  });

  it("mudar status registra na linha do tempo", async () => {
    const { service } = renderDetail();
    await userEvent.selectOptions(await screen.findByLabelText("Status"), "Ready to submit");
    expect(service.items()[0]!.status).toBe("Ready to submit");
    expect(screen.getByText("Status alterado para “Pronta para enviar”")).toBeInTheDocument();
  });

  it("notas salvam sozinhas após uma pausa", async () => {
    const { service } = renderDetail();
    const notes = await screen.findByLabelText("Suas notas sobre esta candidatura");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.type(notes, "Pedir carta");
    expect(screen.getByText("Alterações não salvas…")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(900); });
    vi.useRealTimers();
    expect(await screen.findByText("Notas salvas.")).toBeInTheDocument();
    expect(service.items()[0]!.notes).toBe("Pedir carta");
  });

  it("falha do servidor reverte o checklist e avisa", async () => {
    renderDetail(fakeApplicationService([makeApplication()], { failMutations: true }));
    const box = await screen.findByRole("checkbox", { name: "Diploma" });
    await userEvent.click(box);
    expect(await screen.findByText(/Não foi possível salvar a alteração/)).toBeInTheDocument();
    expect(box).not.toBeChecked();
  });

  it("remover pede confirmação e volta para a lista", async () => {
    const nav = setupTestRouter("/applications/s-1");
    const { service } = renderDetail();
    await userEvent.click(await screen.findByRole("button", { name: "Remover candidatura" }));
    await userEvent.click(screen.getByRole("button", { name: "Sim, remover" }));
    await waitFor(() => expect(nav.current()).toBe("/applications"));
    expect(service.items()).toEqual([]);
  });

  it("id desconhecido mostra estado de não encontrada", async () => {
    renderDetail(fakeApplicationService([]), "x");
    expect(await screen.findByText("Candidatura não encontrada")).toBeInTheDocument();
  });
});
