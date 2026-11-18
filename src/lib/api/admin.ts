import { ApiError, apiRequest } from "./client";
import { isAdminPage, isAdminReports, isScholarship } from "./guards";
import type { AdminReport, AdminScholarship, Scholarship } from "@/types";

export type AdminQuery = { status?: "all" | "active" | "hidden"; verification?: "all" | "verified" | "unverified"; reported?: boolean; search?: string; page?: number };
export type AdminPatch = { status?: "active" | "hidden"; verification?: "verified" | "unverified"; hiddenReason?: string };

/** Painel de administração das bolsas (só contas com role = admin; o servidor confere). */
export interface AdminService {
  list(query: AdminQuery, signal?: AbortSignal): Promise<{ items: AdminScholarship[]; total: number }>;
  patch(id: string, patch: AdminPatch): Promise<Scholarship>;
  put(id: string, body: unknown): Promise<Scholarship>;
  reports(id: string): Promise<AdminReport[]>;
  resolveReports(id: string): Promise<number>;
}

const unexpected = () => new ApiError(502, "Resposta inesperada do servidor.", "unexpected_response");
const path = (id: string) => `/admin/scholarships/${encodeURIComponent(id)}`;

export const apiAdminService: AdminService = {
  async list(query, signal) {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    if (query.verification) params.set("verification", query.verification);
    if (query.reported) params.set("reported", "1");
    if (query.search) params.set("search", query.search);
    if (query.page) params.set("page", String(query.page));
    const data = await apiRequest<unknown>(`/admin/scholarships?${params}`, { signal });
    if (!isAdminPage(data)) throw unexpected();
    return data;
  },
  async patch(id, patch) {
    const data = await apiRequest<unknown>(path(id), { method: "PATCH", body: patch });
    if (!isScholarship(data)) throw unexpected();
    return data;
  },
  async put(id, body) {
    const data = await apiRequest<unknown>(path(id), { method: "PUT", body });
    if (!isScholarship(data)) throw unexpected();
    return data;
  },
  async reports(id) {
    const data = await apiRequest<unknown>(`${path(id)}/reports`);
    if (!isAdminReports(data)) throw unexpected();
    return data.items;
  },
  async resolveReports(id) {
    const data = await apiRequest<{ resolved?: unknown }>(`${path(id)}/reports/resolve`, { method: "POST" });
    return typeof data?.resolved === "number" ? data.resolved : 0;
  }
};
