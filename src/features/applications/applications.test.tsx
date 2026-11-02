import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeApplicationService, makeApplication, makeScholarship } from "@/test/fakes";
import { ScholarshipCard } from "@/features/scholarships/ScholarshipCard";
import { ApplicationsProvider } from "./ApplicationsProvider";
import { ApplicationsBoard } from "./ApplicationsBoard";
import { UpcomingDeadlines } from "./UpcomingDeadlines";
import { MutationErrorNotice } from "./MutationErrorNotice";

const second = makeApplication({
  id: "s-2",
  scholarship: { id: "s-2", title: "Bolsa Antes", institution: "Inst B", deadline: "2026-12-01" }
});

function renderWith(ui: React.ReactNode, service = fakeApplicationService()) {
  return { service, ...render(<ApplicationsProvider service={service}><MutationErrorNotice />{ui}</ApplicationsProvider>) };
}

describe("ApplicationsBoard", () => {
  it("mostra carregamento e depois o estado vazio", async () => {
    renderWith(<ApplicationsBoard />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
    expect(await screen.findByText("Nenhuma candidatura ainda")).toBeInTheDocument();
  });

  it("ordena por prazo e atualiza o status no servidor", async () => {
    const { service } = renderWith(<ApplicationsBoard />, fakeApplicationService([makeApplication(), second]));
    const list = await screen.findByRole("list", { name: "Suas candidaturas" });
    const titles = within(list).getAllByRole("heading").map((h) => h.textContent);
    expect(titles).toEqual(["Bolsa Antes", "Bolsa de Teste em Física"]);

    await userEvent.selectOptions(screen.getByLabelText("Status de Bolsa Antes"), "Preparing");
    expect(screen.getByLabelText("Status de Bolsa Antes")).toHaveValue("Preparing");
    expect(service.items().find((a) => a.id === "s-2")?.status).toBe("Preparing");
  });

  it("remove uma candidatura", async () => {
    const { service } = renderWith(<ApplicationsBoard />, fakeApplicationService([makeApplication()]));
    await userEvent.click(await screen.findByRole("button", { name: "Remover Bolsa de Teste em Física" }));
    expect(await screen.findByText("Nenhuma candidatura ainda")).toBeInTheDocument();
    expect(service.items()).toEqual([]);
  });

  it("reverte e avisa quando o servidor recusa a alteração", async () => {
    renderWith(<ApplicationsBoard />, fakeApplicationService([makeApplication()], { failMutations: true }));
    await userEvent.click(await screen.findByRole("button", { name: "Remover Bolsa de Teste em Física" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível salvar a alteração");
    expect(screen.getByRole("heading", { name: "Bolsa de Teste em Física" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText(/Não foi possível salvar/)).not.toBeInTheDocument();
  });

  it("erro ao carregar oferece nova tentativa", async () => {
    renderWith(<ApplicationsBoard />, fakeApplicationService([], { failList: true }));
    expect(await screen.findByText("Não foi possível carregar suas candidaturas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });
});

describe("UpcomingDeadlines", () => {
  it("mostra no máximo 3 prazos, do mais próximo ao mais distante", async () => {
    const apps = ["2027-05-01", "2027-01-01", "2027-03-01", "2027-02-01"].map((deadline, i) =>
      makeApplication({ id: `a${i}`, scholarship: { id: `a${i}`, title: `Bolsa ${deadline}`, institution: "I", deadline } })
    );
    renderWith(<UpcomingDeadlines />, fakeApplicationService(apps));
    const links = await screen.findAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Bolsa 2027-01-01", "Bolsa 2027-02-01", "Bolsa 2027-03-01"]);
  });
});

describe("ScholarshipCard + SaveButton", () => {
  it("salvar alterna aria-pressed e grava no serviço", async () => {
    const { service } = renderWith(<ul><ScholarshipCard item={makeScholarship()} /></ul>);
    const button = await screen.findByRole("button", { name: "Salvar: Bolsa de Teste em Física" });
    await screen.findByRole("button", { pressed: false });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(service.items().map((a) => a.id)).toEqual(["s-1"]);

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(service.items()).toEqual([]);
  });

  it("fica desabilitado enquanto as candidaturas carregam", () => {
    renderWith(<ul><ScholarshipCard item={makeScholarship()} /></ul>);
    expect(screen.getByRole("button", { name: /Salvar/ })).toBeDisabled();
  });

  it("mostra dados principais e link para detalhes", () => {
    renderWith(<ul><ScholarshipCard item={makeScholarship({ verification: { status: "verified" } })} /></ul>);
    expect(screen.getByRole("link", { name: "Bolsa de Teste em Física" })).toHaveAttribute("href", "/scholarships/s-1");
    expect(screen.getByText("Verificada")).toBeInTheDocument();
    expect(screen.getByText(/Prazo: 31 de jan/)).toBeInTheDocument();
  });
});
