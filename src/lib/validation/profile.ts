import type { ProfileInput } from "@/types";

export type ProfileField = keyof ProfileInput;
/** Códigos de erro de campo. Os mesmos códigos são devolvidos pela API em `error.fields` (422). */
export type ProfileErrorCode = "required" | "too_long";
export type ProfileErrors = Partial<Record<ProfileField, ProfileErrorCode>>;

export const PROFILE_MAX_LENGTH: Record<ProfileField, number> = {
  residence: 80, nationality: 80, level: 40, field: 120, grade: 60, languages: 200, interests: 1000
};

export const REQUIRED_PROFILE_FIELDS: ProfileField[] = ["residence", "level"];

export const emptyProfile: ProfileInput = { residence: "", nationality: "", level: "", field: "", grade: "", languages: "", interests: "" };

/** Validação do lado do cliente. O servidor valida de novo; a interface nunca confia só nesta função. */
export function validateProfile(input: ProfileInput): ProfileErrors {
  const errors: ProfileErrors = {};
  for (const key of Object.keys(PROFILE_MAX_LENGTH) as ProfileField[]) {
    const value = input[key].trim();
    if (REQUIRED_PROFILE_FIELDS.includes(key) && !value) errors[key] = "required";
    else if (value.length > PROFILE_MAX_LENGTH[key]) errors[key] = "too_long";
  }
  return errors;
}
