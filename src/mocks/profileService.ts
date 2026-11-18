import type { ProfileService } from "@/lib/api/profile";
import { ApiError } from "@/lib/api/client";
import { completenessOf, emptyProfile, toInput, validateProfile } from "@/lib/validation/profile";
import type { Profile } from "@/types";

// DEMONSTRAÇÃO: perfil só em memória. Nada é enviado a servidor nem gravado no navegador.
const fresh = (): Profile => ({ ...emptyProfile, completeness: completenessOf(emptyProfile) });
let profile: Profile = fresh();

export const mockProfileService: ProfileService = {
  async get() {
    return structuredClone(profile);
  },
  async update(input) {
    const fields = validateProfile(input);
    if (Object.keys(fields).length > 0) throw new ApiError(422, "Alguns campos são inválidos.", "validation_failed", fields);
    const clean = toInput({ ...input, fieldDetail: input.fieldDetail.trim(), goals: input.goals.trim() });
    profile = { ...clean, completeness: completenessOf(clean), updatedAt: new Date().toISOString() };
    return structuredClone(profile);
  }
};

/** Só para testes. */
export function __resetMockProfile() {
  profile = fresh();
}
