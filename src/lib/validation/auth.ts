export type AuthField = "name" | "email" | "password";
export type AuthErrorCode = "required" | "invalid" | "too_short" | "taken";
export type AuthErrors = Partial<Record<AuthField, AuthErrorCode>>;
export type AuthMode = "login" | "register" | "forgot";

// Verificação simples de formato; a confirmação real do e-mail é do backend.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateAuth(mode: AuthMode, values: Record<AuthField, string>): AuthErrors {
  const errors: AuthErrors = {};
  if (mode === "register" && !values.name.trim()) errors.name = "required";
  if (!values.email.trim()) errors.email = "required";
  else if (!EMAIL.test(values.email.trim())) errors.email = "invalid";
  if (mode !== "forgot") {
    if (!values.password) errors.password = "required";
    else if (mode === "register" && values.password.length < 8) errors.password = "too_short";
  }
  return errors;
}
