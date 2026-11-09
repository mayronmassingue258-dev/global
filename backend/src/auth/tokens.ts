import { createHash, randomBytes } from "node:crypto";

/** Token aleatório de 256 bits (cookie de sessão / link de redefinição). Só o hash vai para a base. */
export function newToken(): { token: string; id: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, id: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
