import { API_BASE_URL } from "@/lib/config";

/**
 * Erro de API com mensagem segura para exibir. O corpo bruto da resposta nunca é mostrado ao usuário.
 * `code` e `fields` vêm do envelope de erro do contrato (docs/api-contract.md) quando presentes;
 * a interface usa apenas os CÓDIGOS para escolher as próprias mensagens.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fields?: Record<string, string>;
  constructor(status: number, message: string, code?: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** `body` é enviado como JSON; `rawBody` (ex.: FormData) vai como está, e o navegador define o Content-Type. */
type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; rawBody?: BodyInit };

export function safeMessage(status: number): string {
  if (status === 0) return "Não foi possível conectar ao servidor.";
  if (status === 401) return "Sua sessão expirou. Entre novamente.";
  if (status === 403) return "Você não tem permissão para acessar este recurso.";
  if (status === 404) return "Recurso não encontrado.";
  if (status === 409) return "Este registro já existe.";
  if (status === 422) return "Alguns campos são inválidos. Revise e tente novamente.";
  if (status === 429) return "Muitas solicitações. Aguarde um instante e tente novamente.";
  if (status >= 500) return "O servidor encontrou um problema. Tente novamente em instantes.";
  return "Não foi possível concluir a solicitação.";
}

/** Lê `{ error: { code, fields } }` sem confiar no formato; ignora qualquer outra coisa. */
async function readErrorEnvelope(response: Response): Promise<{ code?: string; fields?: Record<string, string> }> {
  try {
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null) return {};
    const error = (data as { error?: unknown }).error;
    if (typeof error !== "object" || error === null) return {};
    const { code, fields } = error as { code?: unknown; fields?: unknown };
    const out: { code?: string; fields?: Record<string, string> } = {};
    if (typeof code === "string") out.code = code;
    if (typeof fields === "object" && fields !== null) {
      out.fields = Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Cliente HTTP central.
 * PENDENTE com o backend: modelo de autenticação (cookies vs. token). Por isso `credentials`
 * NÃO é definido aqui; quem integrar deve passá-lo conscientemente quando o contrato existir.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError(0, "A URL da API não está configurada.", "config_missing");

  const { body, rawBody, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (body !== undefined && rawBody === undefined) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      ...init,
      headers,
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, safeMessage(0), "network_error");
  }

  if (!response.ok) {
    const { code, fields } = await readErrorEnvelope(response);
    throw new ApiError(response.status, safeMessage(response.status), code, fields);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
