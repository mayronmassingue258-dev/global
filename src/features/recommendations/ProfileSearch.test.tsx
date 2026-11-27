import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/client";
import type { RecommendationService } from "@/lib/api/recommendations";
import type { ProfileSearch as Search } from "@/types";
import { ProfileSearch } from "./ProfileSearch";

function fake(latest: Search | null = null) {
  let current = latest;
  const service = {
    list: vi.fn(),
    report: vi.fn(),
    search: vi.fn(async () => { current = { id: 7, status: "running" as const }; return current; }),
    latestSearch: vi.fn(async () => current),
    finish: (created: number) => { current = { id: 7, status: "done", summary: { created, updated: 0 } }; }
  };
  return service as unknown as RecommendationService & typeof service;
}

describe("ProfileSearch (Procurar novas bolsas para mim)", () => {
  it("começa a busca, mostra o andamento e avisa a lista quando termina", async () => {
    const s = fake();
    const onFinished = vi.fn();
    render(<ProfileSearch service={s} onFinished={onFinished} pollMs={20} />);
    await userEvent.click(screen.getByRole("button", { name: "Procurar novas bolsas para mim" }));
    expect(await screen.findByText(/Procurando bolsas para o seu perfil/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Procurar novas bolsas para mim" })).toBeDisabled();
    s.finish(3);
    await waitFor(() => expect(onFinished).toHaveBeenCalled());
    expect(screen.getByText("Busca concluída: 3 bolsas novas.")).toBeInTheDocument();
  });

  it("mostra a última busca ao abrir (inclusive sem resultado novo)", async () => {
    render(<ProfileSearch service={fake({ id: 1, status: "done", summary: { created: 0, updated: 0 } })} onFinished={() => {}} />);
    expect(await screen.findByText(/nenhuma bolsa nova para o seu perfil/)).toBeInTheDocument();
  });

  it.each([
    [new ApiError(422, "x", "validation_failed", { profile: "incomplete" }), /Complete o perfil/],
    [new ApiError(429, "x", "search_limit_user"), /últimas 24 horas/],
    [new ApiError(429, "x", "search_limit_daily"), /Muitas buscas hoje/],
    [new ApiError(409, "x", "discovery_running"), /já há uma busca em andamento/i],
    [new ApiError(409, "x", "discovery_not_configured"), /não está disponível/]
  ])("explica cada recusa (%s)", async (error, text) => {
    const s = fake();
    s.search.mockRejectedValueOnce(error);
    render(<ProfileSearch service={s} onFinished={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Procurar novas bolsas para mim" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });
});
