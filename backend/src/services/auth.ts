import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { passwordResets, sessions, users } from "../db/schema.js";
import { dummyVerify, hashPassword, verifyPassword } from "../auth/passwords.js";
import { hashToken, newToken } from "../auth/tokens.js";
import type { EmailSender } from "../auth/email.js";
import { HttpError, validationFailed } from "../lib/errors.js";

/** Regras de conta. Códigos de erro de campo seguem o contrato (required, invalid, too_short, too_long, taken). */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
const NAME_MAX = 100;
const EMAIL_MAX = 254;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESET_TTL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PublicUser = { id: string; email: string; name: string };
const toPublic = (u: { id: string; email: string; name: string }): PublicUser => ({ id: u.id, email: u.email, name: u.name });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (b: Record<string, unknown>, k: string) => (typeof b[k] === "string" ? (b[k] as string) : null);

function checkEmail(raw: string | null, fields: Record<string, string>): string {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email) fields.email = "required";
  else if (email.length > EMAIL_MAX || !EMAIL.test(email)) fields.email = "invalid";
  return email;
}

function checkNewPassword(raw: string | null, fields: Record<string, string>): string {
  const password = raw ?? "";
  if (!password) fields.password = "required";
  else if (password.length < PASSWORD_MIN) fields.password = "too_short";
  else if (password.length > PASSWORD_MAX) fields.password = "too_long";
  return password;
}

export function parseRegister(body: unknown) {
  const b = isRecord(body) ? body : {};
  const fields: Record<string, string> = {};
  const name = (str(b, "name") ?? "").trim();
  if (!name) fields.name = "required";
  else if (name.length > NAME_MAX) fields.name = "too_long";
  const email = checkEmail(str(b, "email"), fields);
  const password = checkNewPassword(str(b, "password"), fields);
  if (Object.keys(fields).length > 0) throw validationFailed(fields);
  return { name, email, password };
}

export function parseLogin(body: unknown) {
  const b = isRecord(body) ? body : {};
  const fields: Record<string, string> = {};
  const email = (str(b, "email") ?? "").trim().toLowerCase();
  const password = str(b, "password") ?? "";
  if (!email) fields.email = "required";
  if (!password) fields.password = "required";
  if (Object.keys(fields).length > 0) throw validationFailed(fields);
  return { email, password: password.slice(0, PASSWORD_MAX) };
}

export function parseForgot(body: unknown) {
  const b = isRecord(body) ? body : {};
  const fields: Record<string, string> = {};
  const email = checkEmail(str(b, "email"), fields);
  if (Object.keys(fields).length > 0) throw validationFailed(fields);
  return { email };
}

export function parseReset(body: unknown) {
  const b = isRecord(body) ? body : {};
  const fields: Record<string, string> = {};
  const token = str(b, "token") ?? "";
  if (!token) fields.token = "required";
  const password = checkNewPassword(str(b, "password"), fields);
  if (Object.keys(fields).length > 0) throw validationFailed(fields);
  return { token, password };
}

async function findUserByEmail(db: Database, email: string) {
  const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email)).limit(1);
  return user ?? null;
}

export async function createSession(db: Database, userId: string, userAgent: string, days: number) {
  const { token, id } = newToken();
  await db.insert(sessions).values({ id, userId, userAgent: userAgent.slice(0, 300), expiresAt: new Date(Date.now() + days * DAY_MS) });
  return token;
}

/**
 * Valida o token do cookie. Sessão vencida é apagada. Sessão em uso é renovada (no máximo uma vez por dia),
 * então quem usa o site com frequência não é desconectado.
 */
export async function resolveSession(db: Database, token: string, days: number): Promise<PublicUser | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({ expiresAt: sessions.expiresAt, user: { id: users.id, email: users.email, name: users.name } })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id)).limit(1);
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (row.expiresAt.getTime() - now < (days - 1) * DAY_MS) {
    await db.update(sessions).set({ expiresAt: new Date(now + days * DAY_MS) }).where(eq(sessions.id, id));
  }
  return toPublic(row.user);
}

export async function destroySession(db: Database, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export async function register(db: Database, input: ReturnType<typeof parseRegister>) {
  if (await findUserByEmail(db, input.email)) throw new HttpError(409, "email_taken", { email: "taken" });
  const passwordHash = await hashPassword(input.password);
  try {
    const [user] = await db.insert(users).values({ email: input.email, name: input.name, passwordHash }).returning();
    return toPublic(user!);
  } catch (error) {
    // Dois cadastros simultâneos com o mesmo e-mail: o índice único da base decide.
    if ((error as { cause?: { code?: string } }).cause?.code === "23505") throw new HttpError(409, "email_taken", { email: "taken" });
    throw error;
  }
}

/** Mesma resposta (e tempo parecido) para e-mail inexistente e senha errada: não revela quem tem conta. */
export async function login(db: Database, input: ReturnType<typeof parseLogin>) {
  const user = await findUserByEmail(db, input.email);
  if (!user?.passwordHash) {
    await dummyVerify(input.password);
    throw new HttpError(401, "invalid_credentials");
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) throw new HttpError(401, "invalid_credentials");
  return toPublic(user);
}

/** Sempre "sucesso" para quem chama (não revela se o e-mail existe). Só envia e-mail se a conta existir. */
export async function requestPasswordReset(db: Database, email: string, sender: EmailSender, appUrl: string) {
  const user = await findUserByEmail(db, email);
  if (!user) return;
  const { token, id } = newToken();
  await db.insert(passwordResets).values({ id, userId: user.id, expiresAt: new Date(Date.now() + RESET_TTL_MS) });
  const link = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  await sender.send({
    to: user.email,
    subject: "Redefinir sua senha do GlobalScholar",
    text: [
      `Olá, ${user.name}.`,
      "",
      "Recebemos um pedido para redefinir a sua senha. Para escolher uma nova, abra o link abaixo (válido por 1 hora):",
      link,
      "",
      "Se não foi você, ignore este e-mail: a sua senha continua a mesma."
    ].join("\n")
  });
}

/** Troca a senha, marca o link como usado e encerra TODAS as sessões abertas da conta. */
export async function resetPassword(db: Database, input: ReturnType<typeof parseReset>) {
  const id = hashToken(input.token);
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    const [reset] = await tx.select().from(passwordResets)
      .where(and(eq(passwordResets.id, id), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
      .for("update").limit(1);
    if (!reset) throw new HttpError(400, "invalid_token");
    await tx.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, id));
    await tx.delete(sessions).where(eq(sessions.userId, reset.userId));
  });
}

/** Limpeza periódica: sessões vencidas e links de redefinição antigos. */
export async function purgeExpired(db: Database) {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.delete(passwordResets).where(lt(passwordResets.expiresAt, new Date(Date.now() - DAY_MS)));
}
