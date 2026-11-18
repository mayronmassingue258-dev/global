import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/client";
import type { AdminService } from "@/lib/api/admin";
import { makeScholarship } from "@/test/fakes";
import type { AdminScholarship } from "@/types";
import { AdminPanel, toImportFormat } from "./AdminPanel";

const item = (over: Partial<AdminScholarship> = {}): AdminScholarship => ({ ...makeScholarship({ id: "b-1", title: "Bolsa Um", status: "active", origin: "discovery" }), openReports: 0, ...over });

function fakeAdmin(items: AdminScholarship[]) {
  const service = {
    list: vi.fn((_q: unknown) => Promise.resolve({ items, total: items.length })),
    patch: vi.fn(() => Promise.resolve(makeScholarship())),
    put: vi.fn((_id: string, _b: unknown) => Promise.resolve(makeScholarship())),
    reports: vi.fn(() => Promise.resolve([{ id: 1, reason: "broken_link" as const, message: "dá 404", createdAt: "2026-11-10T10:00:00Z", reporter: "a@b.c" }])),
    resolveReports: vi.fn(() => Promise.resolve(1))
  };
  return service satisfies AdminService;
}

describe("AdminPanel", () => {
  it("lista com situação, verificação e relatos; verifica e oculta", async () => {
    const s = fakeAdmin([item({ openReports: 2 }), item({ id: "b-2", title: "Bolsa Dois", status: "hidden", hiddenReason: "deadline_passed", verification: { status: "verified", verifiedAt: "2026-11-01" } })]);
    render(<AdminPanel service={s} />);
    const rows = await screen.findAllByRole("listitem");
    expect(within(rows[0]!).getByText("No ar")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("2 relatos")).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/busca automática/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Oculta · prazo vencido")).toBeInTheDocument();

    await userEvent.click(within(rows[0]!).getByRole("button", { name: "Marcar como verificada" }));
    expect(s.patch).toHaveBeenCalledWith("b-1", { verification: "verified" });
    await userEvent.click(within(rows[1]!).getByRole("button", { name: "Pôr no ar" }));
    expect(s.patch).toHaveBeenCalledWith("b-2", { status: "active" });
  });

  it("filtros recarregam a lista", async () => {
    const s = fakeAdmin([item()]);
    render(<AdminPanel service={s} />);
    await screen.findByText("Bolsa Um");
    await userEvent.selectOptions(screen.getByLabelText("Situação"), "hidden");
    await userEvent.click(screen.getByLabelText("Só reportadas"));
    await userEvent.type(screen.getByLabelText(/Buscar por título/), "daad{enter}");
    await waitFor(() => expect(s.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "hidden", reported: true, search: "daad", page: 1 }), expect.anything()));
  });

  it("relatos: mostra e resolve", async () => {
    const s = fakeAdmin([item({ openReports: 1 })]);
    render(<AdminPanel service={s} />);
    await userEvent.click(await screen.findByRole("button", { name: "Ver relatos" }));
    expect(await screen.findByText("O link do edital não funciona")).toBeInTheDocument();
    expect(screen.getByText("dá 404")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Marcar relatos como resolvidos" }));
    expect(s.resolveReports).toHaveBeenCalledWith("b-1");
  });

  it("edita em JSON: valida o JSON e mostra os erros do servidor", async () => {
    const s = fakeAdmin([item()]);
    s.put.mockRejectedValueOnce(new ApiError(422, "x", "validation_failed", { "match.levels": "required" }));
    render(<AdminPanel service={s} />);
    await userEvent.click(await screen.findByRole("button", { name: "Editar (JSON)" }));
    const box = screen.getByLabelText("Bolsa no formato do importador");
    expect(JSON.parse((box as HTMLTextAreaElement).value)).toMatchObject({ title: "Bolsa Um" });
    expect(JSON.parse((box as HTMLTextAreaElement).value)).not.toHaveProperty("openReports");
    await userEvent.click(screen.getByRole("button", { name: "Salvar bolsa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Corrija: match.levels (required)");

    await userEvent.clear(box);
    await userEvent.type(box, "{{nope");
    await userEvent.click(screen.getByRole("button", { name: "Salvar bolsa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("JSON inválido.");
  });

  it("nova bolsa com modelo; erro ao carregar", async () => {
    const s = fakeAdmin([]);
    render(<AdminPanel service={s} />);
    expect(await screen.findByText("Nenhuma bolsa com estes filtros.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Nova bolsa (JSON)" }));
    await userEvent.type(screen.getByLabelText(/^Id/), "bolsa-nova");
    await userEvent.click(screen.getByRole("button", { name: "Salvar bolsa" }));
    await waitFor(() => expect(s.put).toHaveBeenCalledWith("bolsa-nova", expect.objectContaining({ match: expect.objectContaining({ levels: ["master"] }) })));

    s.list.mockRejectedValueOnce(new Error("x"));
    await userEvent.selectOptions(screen.getByLabelText("Verificação"), "verified");
    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  });

  it("toImportFormat tira os campos que o servidor calcula", () => {
    const out = toImportFormat(item({ openReports: 3, hiddenReason: "x", lastCheckedAt: "2026-01-01T00:00:00Z" }));
    expect(out).not.toHaveProperty("id");
    expect(out).not.toHaveProperty("status");
    expect(out).not.toHaveProperty("openReports");
    expect(out).toHaveProperty("title", "Bolsa Um");
  });
});
