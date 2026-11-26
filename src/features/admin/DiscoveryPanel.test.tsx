import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/client";
import type { AdminService } from "@/lib/api/admin";
import type { DiscoveryRun, DiscoveryState } from "@/types";
import { DiscoveryPanel } from "./DiscoveryPanel";

const run = (over: Partial<DiscoveryRun> = {}): DiscoveryRun => ({ id: 1, status: "done", dryRun: true, provider: "gemini", sources: ["chevening"], startedAt: "2026-11-26T10:00:00Z", summary: { created: 2, updated: 1, skipped: 3 }, ...over });

function fake(state: Partial<DiscoveryState> = {}) {
  let current: DiscoveryState = { provider: "gemini", configured: true, sources: [{ id: "chevening", name: "Chevening" }, { id: "daad", name: "DAAD" }], weekSources: ["chevening"], items: [], ...state };
  const service = {
    discovery: vi.fn(async () => current),
    startDiscovery: vi.fn(async (input: { dryRun: boolean }) => {
      const created = run({ id: 9, status: "running", dryRun: input.dryRun, summary: undefined });
      current = { ...current, items: [created, ...current.items] };
      return created;
    }),
    discoveryRun: vi.fn(async (id: number) => ({ ...run({ id }), log: "▶ Chevening\n  ✓ nova: Bolsa Chevening" })),
    finish: () => { current = { ...current, items: current.items.map((r) => ({ ...r, status: "done" as const, summary: { created: 1, updated: 0, skipped: 0 } })) }; }
  };
  return service as unknown as AdminService & typeof service;
}

describe("DiscoveryPanel", () => {
  it("sem chave configurada: explica onde pôr a chave no Render", async () => {
    render(<DiscoveryPanel service={fake({ configured: false })} />);
    expect(await screen.findByText(/Falta configurar a chave GEMINI_API_KEY no Render/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buscar e publicar" })).not.toBeInTheDocument();
  });

  it("começa um ensaio com a fonte escolhida, acompanha até terminar e mostra o registro", async () => {
    const s = fake();
    const onFinished = vi.fn();
    render(<DiscoveryPanel service={s} pollMs={20} onFinished={onFinished} />);
    await userEvent.selectOptions(await screen.findByLabelText("Fontes"), "daad");
    await userEvent.click(screen.getByRole("button", { name: "Ensaio (só mostra, não grava)" }));
    expect(s.startDiscovery).toHaveBeenCalledWith({ dryRun: true, sources: ["daad"] });
    expect(await screen.findByText(/Buscando…/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar e publicar" })).toBeDisabled();
    s.finish();
    await waitFor(() => expect(onFinished).toHaveBeenCalled());
    expect(await screen.findByText(/✓ nova: Bolsa Chevening/)).toBeInTheDocument();
    expect(screen.getByText("1 novas · 0 atualizadas · 0 ignoradas")).toBeInTheDocument();
  });

  it("publicação usa o rodízio da semana por padrão; busca já rodando vira aviso", async () => {
    const s = fake();
    s.startDiscovery.mockRejectedValueOnce(new ApiError(409, "x", "discovery_running"));
    render(<DiscoveryPanel service={s} />);
    await userEvent.click(await screen.findByRole("button", { name: "Buscar e publicar" }));
    expect(s.startDiscovery).toHaveBeenCalledWith({ dryRun: false, sources: "week" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Já há uma busca rodando");
  });

  it("histórico com resumo e registro sob demanda", async () => {
    render(<DiscoveryPanel service={fake({ items: [run()] })} />);
    expect(await screen.findByText("2 novas · 1 atualizadas · 3 ignoradas")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver registro" }));
    expect(await screen.findByText(/Bolsa Chevening/)).toBeInTheDocument();
  });
});
