import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeApplicationService, makeScholarship } from "@/test/fakes";
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

const renderBrowser = (initialQuery = "") =>
  render(<ApplicationsProvider service={fakeApplicationService()}><ScholarshipBrowser initialQuery={initialQuery} /></ApplicationsProvider>);

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

  it("busca com espera (debounce) e usa a busca inicial da URL", async () => {
    respondWith();
    renderBrowser("Bolsa 1");
    await screen.findByText("3 resultados");
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Bolsa 1", page: 1 }), expect.any(AbortSignal));

    const input = screen.getByLabelText("Buscar bolsas");
    await userEvent.clear(input);
    await userEvent.type(input, "Bolsa 11");
    expect(await screen.findByText("1 resultado")).toBeInTheDocument();
  });

  it("estado vazio permite limpar filtros", async () => {
    respondWith();
    renderBrowser("nada disso");
    expect(await screen.findByText("Nenhuma bolsa encontrada")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(await screen.findByText("12 resultados")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar bolsas")).toHaveValue("");
  });

  it("envia nível e ordenação escolhidos", async () => {
    respondWith();
    renderBrowser();
    await screen.findByText("12 resultados");
    await userEvent.click(screen.getByText(/Filtros e ordenação/));
    await userEvent.selectOptions(screen.getByLabelText("Nível de estudo"), "Doutorado");
    await userEvent.selectOptions(screen.getByLabelText("Ordenar por"), "title");
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ level: "Doutorado", sort: "title", page: 1 }), expect.any(AbortSignal))
    );
    expect(screen.getByText("Filtros e ordenação (ativos)")).toBeInTheDocument();
  });

  it("erro mostra 'Tentar novamente' e recupera", async () => {
    list.mockRejectedValueOnce(new Error("offline"));
    renderBrowser();
    const retry = await screen.findByRole("button", { name: "Tentar novamente" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    respondWith();
    await userEvent.click(retry);
    expect(await screen.findByText("12 resultados")).toBeInTheDocument();
  });
});
