import { ApiError, apiRequest } from "./client";
import { isProfile } from "./guards";
import type { Profile, ProfileInput } from "@/types";

export interface ProfileService {
  get(signal?: AbortSignal): Promise<Profile>;
  update(input: ProfileInput): Promise<Profile>;
}

const unexpected = () => new ApiError(502, "Resposta inesperada do servidor.", "unexpected_response");

// PROVISÓRIO: caminhos descritos em docs/api-contract.md, a confirmar com o backend.
export const apiProfileService: ProfileService = {
  async get(signal) {
    const data = await apiRequest<unknown>("/profile", { signal });
    if (!isProfile(data)) throw unexpected();
    return data;
  },
  async update(input) {
    const data = await apiRequest<unknown>("/profile", { method: "PUT", body: input });
    if (!isProfile(data)) throw unexpected();
    return data;
  }
};
