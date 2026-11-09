import { eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { users } from "../db/schema.js";
import { verifyPassword } from "../auth/passwords.js";
import { HttpError, validationFailed } from "../lib/errors.js";
import { listApplications } from "./applications.js";
import { listDrafts } from "./drafts.js";
import { getProfile } from "./profile.js";

/**
 * Exportação dos dados do estudante (direito de acesso): conta, perfil, candidaturas (com checklist, notas,
 * linha do tempo e dados dos arquivos) e rascunhos, num JSON legível. O conteúdo dos arquivos fica de fora
 * (cada um pode ser baixado na própria candidatura).
 */
export async function exportAccount(db: Database, userId: string) {
  const [user] = await db.select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new HttpError(401, "unauthenticated");
  const [profile, applications, drafts] = await Promise.all([getProfile(db, userId), listApplications(db, userId), listDrafts(db, userId)]);
  return {
    exportedAt: new Date().toISOString(),
    account: { ...user, createdAt: user.createdAt.toISOString() },
    profile,
    applications,
    drafts
  };
}

/**
 * Exclui a conta e TUDO o que é dela (perfil, candidaturas, arquivos, rascunhos, sessões), em cascata na base.
 * Pede a senha de novo: um computador esquecido aberto não basta para apagar a conta de alguém.
 */
export async function deleteAccount(db: Database, userId: string, body: unknown) {
  const password = typeof (body as { password?: unknown } | null)?.password === "string" ? (body as { password: string }).password : "";
  if (!password) throw validationFailed({ password: "required" });
  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) throw validationFailed({ password: "incorrect" });
  await db.delete(users).where(eq(users.id, userId));
}
