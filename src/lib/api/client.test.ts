import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "@/test/fakes";
import { ApiError, apiRequest, safeMessage } from "./client";

const fetchMock = vi.fn<typeof fetch>();
afterEach(() => fetchMock.mockReset());
vi.stubGlobal("fetch", fetchMock);

describe("apiRequest", () => {
  it("monta a URL com a base configurada e envia JSON", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(apiRequest("/profile", { method: "PUT", body: { a: 1 } })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/api/profile");
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe('{"a":1}');
    const headers = new Headers(init?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Accept")).toBe("application/json");
    expect(init?.cache).toBe("no-store");
  });

  it("não define Content-Type quando não há corpo", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await apiRequest("/x");
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).has("Content-Type")).toBe(false);
  });

  it("devolve undefined em 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiRequest("/x", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("converte erro HTTP em ApiError com mensagem segura, código e campos do envelope", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "validation_failed", message: "segredo interno", fields: { residence: "required", n: 3 } } }, 422));
    const error = await apiRequest("/profile").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: "validation_failed", fields: { residence: "required" }, message: safeMessage(422) });
    expect((error as ApiError).message).not.toContain("segredo");
  });

  it("tolera corpo de erro que não é JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>Bad gateway</html>", { status: 502 }));
    await expect(apiRequest("/x")).rejects.toMatchObject({ status: 502, code: undefined });
  });

  it("falha de rede vira ApiError status 0", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(apiRequest("/x")).rejects.toMatchObject({ status: 0, code: "network_error" });
  });

  it("repassa o cancelamento (AbortError) sem transformar", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    await expect(apiRequest("/x")).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("safeMessage", () => {
  it.each([
    [401, "sessão"], [403, "permissão"], [404, "não encontrado"], [422, "campos"], [429, "Muitas"], [500, "servidor"], [418, "Não foi possível"]
  ])("status %i", (status, fragment) => {
    expect(safeMessage(status)).toContain(fragment);
  });
});
