import { API_BASE_URL } from "@/lib/config";

/** Erro de API com mensagem segura para exibir. O corpo bruto da resposta nunca é mostrado ao usuário. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

function safeMessage(status: number): string {
  if (status === 401) return "Sua sessão expirou. Entre novamente.";
  if (status === 403) return "Você não tem permissão para acessar este recurso.";
  if (status === 404) return "Recurso não encontrado.";
  if (status >= 500) return "O servidor encontrou um problema. Tente novamente em instantes.";
  return "Não foi possível concluir a solicitação.";
}

/**
 * Cliente HTTP central.
 * PENDENTE com o backend: modelo de autenticação (cookies vs. token). Por isso `credentials`
 * NÃO é definido aqui; quem integrar deve passá-lo conscientemente quando o contrato existir.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError(0, "A URL da API não está configurada.");

  const { body, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (body !== undefined) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "Não foi possível conectar ao servidor.");
  }

  if (!response.ok) throw new ApiError(response.status, safeMessage(response.status));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
