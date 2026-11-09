import { ApiError, apiRequest } from "./client";
import type { User } from "@/types";

export type RegisterInput = { name: string; email: string; password: string };

/** Contas (docs/api-contract.md, "Contas"). A sessão é um cookie HttpOnly posto pelo backend: o JavaScript nunca o vê. */
export interface AuthService {
  me(headers?: Record<string, string>): Promise<User | null>;
  register(input: RegisterInput): Promise<User>;
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
}

const isUser = (v: unknown): v is User => {
  if (typeof v !== "object" || v === null) return false;
  const u = v as Record<string, unknown>;
  return typeof u.id === "string" && typeof u.email === "string" && typeof u.name === "string";
};

const readUser = (data: unknown): User => {
  const user = (data as { user?: unknown } | null)?.user;
  if (!isUser(user)) throw new ApiError(502, "Resposta inesperada do servidor.", "unexpected_response");
  return user;
};

export const apiAuthService: AuthService = {
  async me(headers) {
    try {
      return readUser(await apiRequest<unknown>("/auth/me", { headers }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  async register(input) {
    return readUser(await apiRequest<unknown>("/auth/register", { method: "POST", body: input }));
  },
  async login(email, password) {
    return readUser(await apiRequest<unknown>("/auth/login", { method: "POST", body: { email, password } }));
  },
  async logout() {
    await apiRequest<void>("/auth/logout", { method: "POST" });
  },
  async forgotPassword(email) {
    await apiRequest<void>("/auth/forgot-password", { method: "POST", body: { email } });
  },
  async resetPassword(token, password) {
    await apiRequest<void>("/auth/reset-password", { method: "POST", body: { token, password } });
  }
};
