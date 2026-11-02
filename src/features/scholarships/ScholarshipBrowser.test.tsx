import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeApplicationService, makeScholarship } from "@/test/fakes";
import { setupTestRouter } from "@/test/router";
import { ApplicationsProvider } from "@/features/applications/ApplicationsProvider";
import type { ScholarshipQuery } from "@/types";

const list = vi.fn();
vi.mock("@/lib/services", () => ({
  scholarshipService: { list: (...args: unknown[]) => list(...args) },
  applicationService: {}
}));

const { ScholarshipBrowser } = await import("./ScholarshipBrowser");

const many = Array.from({ length: 12 }, (_, i) => makeScholarship({ id: `s-${i}`, title: `Bolsa ${i}` }));

function respondWith(source = many) {
  list.mockImplementation(async (q: ScholarshipQuery) => {
    const size = q.pageSize ?? 10;
    const page = q.page ?? 1;
    const filtered = source.filter((s) => !q.search || s.title.includes(q.search));
    return { items: filtered.slice((page - 1) * size, page * size), total: filtered.length };
  });
}

const renderBrowser = (url = "/scholarships") => {
  const nav = setupTestRouter(url);
  render(<ApplicationsProvider service={fakeApplicationService()}><ScholarshipBrowser /></ApplicationsProvider>);
  return nav;
};

beforeEach(() => {
  list.mockReset();
});

describe("ScholarshipBrowser", () => {
  it("carrega a primeira página e anuncia o total", async () => {
    respondWith();
    renderBrowser();
    expect(await screen.findByText("12 resultados")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
  });

  it("'Ver mais' acrescenta a próxima página", async () => {
    respondWith();
    renderBrowser();
    await userEvent.click(await screen.findByRole("button", { name: "Ver mais resultados" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(12));
    expect(screen.queryByRole("button", { name: "Ver mais resultados" })).not.toBeInTheDocument();
  });

  it("lê os filtros da URL e mostra os chips ativos", async () => {
    respondWith();
    renderBrowser("/scholarships?q=Bolsa%201&level=Doutorado&sort=title");
    await screen.findByText("3 resultados");
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Bolsa 1", level: "Doutorado", sort: "title", page: 1 }), expect.any(AbortSignal));
    expect(screen.getByLabelText("Buscar bolsas")).toHaveValue("Bolsa 1");
    const chips = within(screen.getByRole("list", { name: "Filtros ativos" })).getAllByRole("button");
    expect(chips.map((c) => c.getAttribute("aria-label"))).toEqual(["Remover filtro: “Bolsa 1”", "Remover filtro: Nível: Doutorado", "Remover filtro: Ordem: título"]);
  });

  it("digitar atualiza a URL após uma pausa (link compartilhável)", async () => {
    respondWith();
    const nav = renderBrowser();
    await screen.findByText("12 resultados");
    await userEvent.type(screen.getByLabelText("Buscar bolsas"), "Bolsa 11");
    await waitFor(() => expect(nav.current()).toBe("/scholarships?q=Bolsa+11"));
    expect(await screen.findByText("1 resultado")).toBeInTheDocument();
  });

  it("remover um chip tira o filtro da URL", async () => {
    respondWith();
    const nav = renderBrowser("/scholarships?q=Bolsa&level=Mestrado");
    await userEvent.click(await screen.findByRole("button", { name: "Remover filtro: Nível: Mestrado" }));
    expect(nav.current()).toBe("/scholarships?q=Bolsa");
  });

  it("selecionar nível e ordem atualiza a URL", async () => {
    respondWith();
    const nav = renderBrowser();
    await screen.findByText("12 resultados");
    await userEvent.click(screen.getByText(/Filtros e ordenação/));
    await userEvent.selectOptions(screen.getByLabelText("Nível de estudo"), "Doutorado");
    await userEvent.selectOptions(screen.getByLabelText("Ordenar por"), "title");
    expect(nav.current()).toBe("/scholarships?level=Doutorado&sort=title");
    expect(screen.getByText("Filtros e ordenação (ativos)")).toBeInTheDocument();
  });

  it("estado vazio permite limpar tudo", async () => {
    respondWith();
    const nav = renderBrowser("/scholarships?q=nada");
    expect(await screen.findByText("Nenhuma bolsa encontrada")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(nav.current()).toBe("/scholarships");
    expect(await screen.findByText("12 resultados")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar bolsas")).toHaveValue("");
  });

  it("copia o link da busca", async () => {
    respondWith();
    const user = userEvent.setup();
    renderBrowser("/scholarships?q=Bolsa");
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValueOnce(undefined);
    await user.click(await screen.findByRole("button", { name: "Copiar link desta busca" }));
    expect(writeText).toHaveBeenCalled();
    expect(await screen.findByText("Link copiado.")).toBeInTheDocument();
  });

  it("erro mostra 'Tentar novamente' e recupera", async () => {
    list.mockRejectedValueOnce(new Error("offline"));
    renderBrowser();
    const retry = await screen.findByRole("button", { name: "Tentar novamente" });
    respondWith();
    await userEvent.click(retry);
    expect(await screen.findByText("12 resultados")).toBeInTheDocument();
  });
});
