import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

type ScryptParams = { N: number; r: number; p: number; maxmem: number };

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/**
 * Senhas com scrypt (nativo do Node, resistente a força bruta com GPU). Formato guardado:
 * scrypt$N$r$p$saltBase64$hashBase64 — os parâmetros ficam junto, então dá para endurecer no futuro sem invalidar senhas antigas.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEYLEN = 64;
const maxmemFor = (N: number, r: number) => 128 * N * r * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { ...PARAMS, maxmem: maxmemFor(PARAMS.N, PARAMS.r) });
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !n || !r || !p || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const N = Number(n);
  const R = Number(r);
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, { N, r: R, p: Number(p), maxmem: maxmemFor(N, R) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hash fixo para comparar quando o e-mail não existe: o tempo de resposta não revela se a conta existe. */
let dummy: string | null = null;
export async function dummyVerify(password: string) {
  dummy ??= await hashPassword("senha-inexistente-para-equalizar-tempo");
  await verifyPassword(password, dummy);
}
