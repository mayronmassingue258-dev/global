import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, makeApplication, makeScholarship } from "@/test/fakes";
import { emptyProfile } from "@/lib/validation/profile";
import { apiScholarshipService } from "./scholarships";
import { apiApplicationService } from "./applications";
import { apiProfileService } from "./profile";
import { apiDraftService } from "./drafts";
import { makeDraft } from "@/test/fakes";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

describe("apiScholarshipService", () => {
  it("list envia só os filtros preenchidos", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [makeScholarship()], total: 1 }));
    const page = await apiScholarshipService.list({ search: "dados", country: "", level: undefined, sort: "title", page: 2, pageSize: 10 });
    expect(page.total).toBe(1);
    const url = new URL(lastCall().url);
    expect(url.pathname).toBe("/api/scholarships");
    expect(Object.fromEntries(url.searchParams)).toEqual({ search: "dados", sort: "title", page: "2", pageSize: "10" });
  });

  it("list rejeita resposta fora do contrato", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));
    await expect(apiScholarshipService.list({})).rejects.toMatchObject({ status: 502, code: "unexpected_response" });
  });

  it("get codifica o id e devolve null em 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "not_found" } }, 404));
    await expect(apiScholarshipService.get("a/b")).resolves.toBeNull();
    expect(lastCall().url).toBe("http://api.test/api/scholarships/a%2Fb");
  });

  it("get propaga erros que não são 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(apiScholarshipService.get("x")).rejects.toMatchObject({ status: 500 });
  });

  it("eligibility valida o formato", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ scholarshipId: "x", status: "eligible", reasons: [] }));
    await expect(apiScholarshipService.eligibility("x")).resolves.toMatchObject({ status: "eligible" });
    expect(lastCall().url).toBe("http://api.test/api/scholarships/x/eligibility");
  });
});

describe("apiApplicationService", () => {
  it("list lê o envelope { items }", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [makeApplication()] }));
    await expect(apiApplicationService.list()).resolves.toHaveLength(1);
  });

  it("save envia só o id da bolsa", async () => {
    const app = makeApplication();
    fetchMock.mockResolvedValueOnce(jsonResponse(app, 201));
    await apiApplicationService.save(app.scholarship);
    expect(lastCall()).toMatchObject({ method: "POST", url: "http://api.test/api/applications", body: { scholarshipId: app.id } });
  });

  it("update usa PATCH com o novo status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeApplication({ status: "Preparing" })));
    await expect(apiApplicationService.update("s-1", { status: "Preparing" })).resolves.toMatchObject({ status: "Preparing" });
    expect(lastCall()).toMatchObject({ method: "PATCH", body: { status: "Preparing" } });
  });

  it("remove trata 404 como sucesso (já removida)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "not_found" } }, 404));
    await expect(apiApplicationService.remove("s-1")).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(apiApplicationService.remove("s-1")).rejects.toMatchObject({ status: 500 });
  });
});

describe("apiProfileService", () => {
  it("get e update seguem o contrato", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(emptyProfile));
    await expect(apiProfileService.get()).resolves.toEqual(emptyProfile);
    const input = { ...emptyProfile, residence: "Moçambique", level: "Mestrado" };
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...input, updatedAt: "2026-11-01T00:00:00Z" }));
    await apiProfileService.update(input);
    expect(lastCall()).toMatchObject({ method: "PUT", url: "http://api.test/api/profile", body: input });
  });

  it("update rejeita resposta inválida", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ residence: 1 }));
    await expect(apiProfileService.update(emptyProfile)).rejects.toMatchObject({ code: "unexpected_response" });
  });
});

describe("apiApplicationService.get", () => {
  it("devolve a candidatura ou null em 404", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeApplication()));
    await expect(apiApplicationService.get("s-1")).resolves.toMatchObject({ id: "s-1" });
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "not_found" } }, 404));
    await expect(apiApplicationService.get("x")).resolves.toBeNull();
  });
});

describe("apiDraftService", () => {
  const input = { type: "motivation_letter" as const, title: "Carta", program: "", sections: {} };

  it("list, get, create, update e remove seguem o contrato", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [makeDraft()] }));
    await expect(apiDraftService.list()).resolves.toHaveLength(1);

    fetchMock.mockResolvedValueOnce(jsonResponse(makeDraft()));
    await apiDraftService.get("d 1");
    expect(lastCall().url).toBe("http://api.test/api/drafts/d%201");

    fetchMock.mockResolvedValueOnce(jsonResponse(makeDraft(), 201));
    await apiDraftService.create(input);
    expect(lastCall()).toMatchObject({ method: "POST", url: "http://api.test/api/drafts", body: input });

    fetchMock.mockResolvedValueOnce(jsonResponse(makeDraft()));
    await apiDraftService.update("d-1", input);
    expect(lastCall()).toMatchObject({ method: "PUT", body: input });

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "not_found" } }, 404));
    await expect(apiDraftService.remove("d-1")).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "not_found" } }, 404));
    await expect(apiDraftService.get("d-1")).resolves.toBeNull();
  });

  it("rejeita rascunho fora do formato", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...makeDraft(), type: "poema" }));
    await expect(apiDraftService.create(input)).rejects.toMatchObject({ code: "unexpected_response" });
  });
});

describe("uploadApplicationDocument", () => {
  it("envia multipart com o campo file, sem forçar Content-Type JSON", async () => {
    const { uploadApplicationDocument } = await import("./uploads");
    fetchMock.mockResolvedValueOnce(jsonResponse({ name: "d.pdf", size: 3, type: "application/pdf", uploadedAt: "2026-11-02T00:00:00Z" }));
    const file = new File(["abc"], "d.pdf", { type: "application/pdf" });
    await expect(uploadApplicationDocument("s 1", "Diploma de mestrado", file)).resolves.toMatchObject({ name: "d.pdf" });
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(String(url)).toBe("http://api.test/api/applications/s%201/documents/Diploma%20de%20mestrado/file");
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("file")).toBeInstanceOf(File);
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  });

  it("rejeita resposta fora do formato", async () => {
    const { uploadApplicationDocument } = await import("./uploads");
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(uploadApplicationDocument("a", "b", new File(["x"], "x.pdf"))).rejects.toMatchObject({ code: "unexpected_response" });
  });
});
