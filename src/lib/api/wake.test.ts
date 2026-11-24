import { describe, expect, it, vi } from "vitest";
import { fetchWaitingForWake, isRenderWaking } from "./wake";

const res = (status: number, routing?: string) => new Response("x", { status, headers: routing ? { "x-render-routing": routing } : {} });

describe("isRenderWaking", () => {
  it("reconhece o Render acordando a API, e só isso", () => {
    expect(isRenderWaking(res(429, "hibernate-rate-limited"))).toBe(true);
    expect(isRenderWaking(res(503, "anything"))).toBe(true);
    expect(isRenderWaking(res(429))).toBe(false); // 429 da própria API (limite de tentativas): não repetir
    expect(isRenderWaking(res(404, "no-server"))).toBe(false); // serviço não existe: esperar não adianta
    expect(isRenderWaking(res(200))).toBe(false);
  });
});

describe("fetchWaitingForWake", () => {
  it("espera e repete até a API acordar", async () => {
    const attempt = vi.fn()
      .mockResolvedValueOnce(res(429, "hibernate-rate-limited"))
      .mockResolvedValueOnce(res(503, "hibernate-wake"))
      .mockResolvedValueOnce(res(200));
    const sleeps: number[] = [];
    const out = await fetchWaitingForWake(attempt, { sleep: async (ms) => { sleeps.push(ms); } });
    expect(out.status).toBe(200);
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([1000, 2000]);
  });

  it("desiste depois do tempo máximo e devolve a última resposta", async () => {
    let clock = 0;
    const attempt = vi.fn(async () => res(429, "hibernate-rate-limited"));
    const out = await fetchWaitingForWake(attempt, { maxWaitMs: 10_000, now: () => clock, sleep: async (ms) => { clock += ms; } });
    expect(out.status).toBe(429);
    expect(attempt.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("não repete respostas normais da API (nem erros dela)", async () => {
    const attempt = vi.fn(async () => res(401));
    expect((await fetchWaitingForWake(attempt)).status).toBe(401);
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
