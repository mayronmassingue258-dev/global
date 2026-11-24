import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { proxyToBackend, visitorIp } from "./proxy";

const BACKEND = "http://api.test";

function upstream(body: unknown = { ok: true }, init: { status?: number; headers?: [string, string][] } = {}) {
  const headers = new Headers([["content-type", "application/json"], ["content-encoding", "gzip"], ["content-length", "99"], ...(init.headers ?? [])]);
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status: init.status ?? 200, headers }));
}

const call = (fetchMock: ReturnType<typeof upstream>) => {
  const [url, init] = fetchMock.mock.calls[0]!;
  return { url: String(url), init: init!, headers: new Headers(init!.headers) };
};

describe("visitorIp", () => {
  it("prefere cf-connecting-ip, depois o primeiro x-forwarded-for; ignora o que não é IP", () => {
    expect(visitorIp(new Headers({ "cf-connecting-ip": "203.0.113.5", "x-forwarded-for": "1.1.1.1" }))).toBe("203.0.113.5");
    expect(visitorIp(new Headers({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" }))).toBe("198.51.100.2");
    expect(visitorIp(new Headers({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(visitorIp(new Headers({ "cf-connecting-ip": "<script>", "x-forwarded-for": "não-é-ip" }))).toBeNull();
    expect(visitorIp(new Headers())).toBeNull();
  });
});

describe("proxyToBackend", () => {
  it("repassa caminho, busca, método, corpo e cookie; põe a chave interna e o IP do visitante", async () => {
    const fetchMock = upstream({ user: 1 }, { status: 201 });
    const request = new Request("https://site.test/api/auth/login?x=1", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "gs_session=abc", origin: "https://site.test", "cf-connecting-ip": "203.0.113.9", "x-gs-internal": "forjado", "x-gs-client-ip": "1.2.3.4" },
      body: JSON.stringify({ email: "a@b.c" })
    });
    const res = await proxyToBackend(request, ["auth", "login"], { backend: BACKEND, secret: "segredo", fetchImpl: fetchMock });
    const { url, init, headers } = call(fetchMock);
    expect(url).toBe("http://api.test/api/auth/login?x=1");
    expect(init.method).toBe("POST");
    expect(headers.get("cookie")).toBe("gs_session=abc");
    expect(headers.get("origin")).toBe("https://site.test");
    // O visitante não consegue pôr a chave interna nem escolher o próprio IP: o repasse substitui os dois.
    expect(headers.get("x-gs-internal")).toBe("segredo");
    expect(headers.get("x-gs-client-ip")).toBe("203.0.113.9");
    expect(headers.get("accept-encoding")).toBe("identity");
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"email":"a@b.c"}');
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ user: 1 });
  });

  it("sem chave configurada, não manda cabeçalhos internos (e descarta os que o visitante mandou)", async () => {
    const fetchMock = upstream();
    await proxyToBackend(new Request("https://site.test/api/health", { headers: { "x-gs-internal": "forjado", "x-gs-client-ip": "1.2.3.4" } }), ["health"], { backend: BACKEND, fetchImpl: fetchMock });
    const { headers, init } = call(fetchMock);
    expect(headers.has("x-gs-internal")).toBe(false);
    expect(headers.has("x-gs-client-ip")).toBe(false);
    expect(init.body).toBeUndefined();
  });

  it("mantém vários Set-Cookie e tira cabeçalhos de codificação", async () => {
    const fetchMock = upstream({}, { headers: [["set-cookie", "a=1; Path=/"], ["set-cookie", "b=2; Path=/"], ["x-request-id", "r-1"]] });
    const res = await proxyToBackend(new Request("https://site.test/api/x"), ["x"], { backend: BACKEND, fetchImpl: fetchMock });
    expect(res.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
    expect(res.headers.get("x-request-id")).toBe("r-1");
    expect(res.headers.has("content-encoding")).toBe(false);
  });

  it("codifica cada parte do caminho (ex.: nome do documento com espaço)", async () => {
    const fetchMock = upstream();
    await proxyToBackend(new Request("https://site.test/api/x"), ["applications", "b-1", "documents", "Carta de motivação", "file"], { backend: `${BACKEND}/`, fetchImpl: fetchMock });
    expect(call(fetchMock).url).toBe("http://api.test/api/applications/b-1/documents/Carta%20de%20motiva%C3%A7%C3%A3o/file");
  });

  it("enquanto o Render acorda a API, espera e repete o pedido (com o mesmo corpo)", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("Too Many Requests", { status: 429, headers: { "x-render-routing": "hibernate-rate-limited" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: 1 }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.useFakeTimers();
    const pending = proxyToBackend(new Request("https://site.test/api/auth/register", { method: "POST", body: '{"a":1}' }), ["auth", "register"], { backend: BACKEND, fetchImpl: fetchMock });
    await vi.advanceTimersByTimeAsync(1500);
    const res = await pending;
    vi.useRealTimers();
    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) expect(new TextDecoder().decode(init!.body as ArrayBuffer)).toBe('{"a":1}');
  });

  it("backend fora do ar → 502; lento demais → 504; não configurado → 503 (sempre no envelope de erro)", async () => {
    const down = vi.fn<typeof fetch>(async () => { throw new TypeError("fetch failed"); });
    const r1 = await proxyToBackend(new Request("https://site.test/api/x"), ["x"], { backend: BACKEND, fetchImpl: down });
    expect(r1.status).toBe(502);
    expect(await r1.json()).toEqual({ error: { code: "backend_unreachable", message: "backend_unreachable" } });

    const slow = vi.fn<typeof fetch>(async () => { throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); });
    expect((await proxyToBackend(new Request("https://site.test/api/x"), ["x"], { backend: BACKEND, fetchImpl: slow })).status).toBe(504);

    expect((await proxyToBackend(new Request("https://site.test/api/x"), ["x"], { backend: undefined })).status).toBe(503);
  });
});
