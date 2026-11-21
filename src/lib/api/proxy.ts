import "server-only";

/**
 * Repasse /api/* do site → backend. O navegador só fala com o domínio do site, então o cookie de sessão é de
 * primeira parte (Safari e outros bloqueiam cookies de terceiros; *.onrender.com conta como domínios diferentes).
 *
 * Além de repassar, informa ao backend QUEM é o visitante (x-gs-client-ip, valendo só com a chave interna):
 * sem isso, todo pedido pareceria vir do servidor do site e todos os estudantes dividiriam o mesmo limite de
 * tentativas de login.
 */

/** Cabeçalhos que não atravessam o repasse (de conexão, ou que só o próprio repasse pode pôr). */
const DROP_REQUEST = new Set(["host", "connection", "content-length", "accept-encoding", "x-gs-internal", "x-gs-client-ip", "keep-alive", "transfer-encoding", "upgrade"]);
const DROP_RESPONSE = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:.]+$/i;
const looksLikeIp = (v: string) => (IPV4.test(v) || (v.includes(":") && IPV6.test(v))) && v.length <= 45;

/**
 * IP do visitante como chegou ao site: cf-connecting-ip (Cloudflare, na frente do Render; não dá para forjar),
 * senão o primeiro do x-forwarded-for. null quando não há (desenvolvimento local).
 */
export function visitorIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf && looksLikeIp(cf)) return cf;
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first && looksLikeIp(first) ? first : null;
}

const errorResponse = (status: number, code: string) =>
  Response.json({ error: { code, message: code } }, { status, headers: { "cache-control": "no-store" } });

type Options = { backend: string | undefined; secret?: string; timeoutMs?: number; fetchImpl?: typeof fetch };

export async function proxyToBackend(request: Request, path: string[], { backend, secret, timeoutMs = 60_000, fetchImpl = fetch }: Options): Promise<Response> {
  if (!backend) return errorResponse(503, "backend_not_configured");
  const incoming = new URL(request.url);
  const target = `${backend.replace(/\/$/, "")}/api/${path.map(encodeURIComponent).join("/")}${incoming.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!DROP_REQUEST.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("accept-encoding", "identity");
  if (secret) {
    headers.set("x-gs-internal", secret);
    const ip = visitorIp(request.headers);
    if (ip) headers.set("x-gs-client-ip", ip);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetchImpl(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      // Corpo em fluxo (anexos de até 10 MB) sem ler tudo na memória.
      ...(hasBody ? { duplex: "half" } : {})
    } as RequestInit);
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return errorResponse(timedOut ? 504 : 502, timedOut ? "backend_timeout" : "backend_unreachable");
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") out.set(key, value);
  });
  // Vários Set-Cookie precisam ir separados (forEach os juntaria numa linha só).
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", cookie);
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}
