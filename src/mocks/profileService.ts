import type { ProfileService } from "@/lib/api/profile";
import { ApiError } from "@/lib/api/client";
import { emptyProfile, validateProfile } from "@/lib/validation/profile";
import type { Profile } from "@/types";

// DEMONSTRAÇÃO: perfil só em memória. Nada é enviado a servidor nem gravado no navegador.
let profile: Profile = { ...emptyProfile };

export const mockProfileService: ProfileService = {
  async get() {
    return { ...profile };
  },
  async update(input) {
    const fields = validateProfile(input);
    if (Object.keys(fields).length > 0) throw new ApiError(422, "Alguns campos são inválidos.", "validation_failed", fields);
    profile = { ...input, updatedAt: new Date().toISOString() };
    return { ...profile };
  }
};

/** Só para testes. */
export function __resetMockProfile() {
  profile = { ...emptyProfile };
}
