import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { like, sql } from "drizzle-orm";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { createDb, type Database } from "./client.js";
import { eligibilityCriteria, scholarships } from "./schema.js";
import { STUDY_LEVELS } from "../lib/validation.js";

/**
 * Importa bolsas REAIS de um arquivo JSON (lista no formato do contrato + critérios opcionais).
 *
 *   npm run scholarships:import -- bolsas.json --dry-run       # só valida e mostra o que faria
 *   npm run scholarships:import -- bolsas.json                 # grava (tudo ou nada, numa transação)
 *   npm run scholarships:import -- bolsas.json --remove-demo   # grava e apaga as bolsas fictícias "amostra-*"
 *
 * Modelo de arquivo: backend/scholarships.example.json. Bolsas já existentes (mesmo id) são atualizadas.
 */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD").refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "data inexistente");
const text = (max: number) => z.string().trim().min(1, "obrigatório").max(max, `no máximo ${max} caracteres`);
const list = z.array(z.string().trim().min(1).max(300)).max(50);

export const scholarshipInput = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, "só letras minúsculas, números e hífen (2 a 64)"),
  title: text(200),
  institution: text(200),
  country: text(100),
  level: z.enum(STUDY_LEVELS),
  fundingType: text(60),
  funding: text(1000),
  deadline: date,
  deadlineTimezone: z.string().trim().max(60).optional(),
  summary: text(2000),
  requirements: list,
  requiredDocuments: list,
  applicationProcess: z.string().trim().max(4000).optional(),
  eligibleCountries: list.optional(),
  sourceUrl: z.string().url().refine((u) => u.startsWith("https://"), "use https://").optional(),
  verification: z.object({ status: z.enum(["verified", "unverified"]), verifiedAt: date.optional() })
    .refine((v) => v.status === "verified" || !v.verifiedAt, "verifiedAt só com status verified"),
  criteria: z.object({
    acceptedLevels: z.array(z.enum(STUDY_LEVELS)).default([]),
    needs: z.array(z.enum(["grade", "languages", "field", "nationality"])).default([])
  }).optional()
}).strict();

export type ScholarshipInput = z.infer<typeof scholarshipInput>;

/** Valida a lista inteira. Devolve as bolsas válidas OU todos os erros, com posição e campo. */
export function validateScholarships(data: unknown): { ok: true; items: ScholarshipInput[] } | { ok: false; errors: string[] } {
  if (!Array.isArray(data)) return { ok: false, errors: ["O arquivo precisa ser uma lista JSON: [ { ... }, { ... } ]."] };
  const errors: string[] = [];
  const items: ScholarshipInput[] = [];
  const seen = new Set<string>();
  data.forEach((raw, index) => {
    const label = `#${index + 1}${typeof (raw as { id?: unknown })?.id === "string" ? ` (${(raw as { id: string }).id})` : ""}`;
    const parsed = scholarshipInput.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`${label} ${issue.path.join(".") || "(item)"}: ${issue.message}`);
      return;
    }
    if (seen.has(parsed.data.id)) errors.push(`${label} id: repetido no arquivo`);
    seen.add(parsed.data.id);
    items.push(parsed.data);
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, items };
}

/** Grava tudo numa transação: se algo falhar, nada muda. */
export async function importScholarships(db: Database, items: ScholarshipInput[], options: { removeDemo?: boolean } = {}) {
  return db.transaction(async (tx) => {
    let removed = 0;
    if (options.removeDemo) {
      // Atenção: apagar uma bolsa apaga também as candidaturas que estudantes tinham salvo nela.
      removed = (await tx.delete(scholarships).where(like(scholarships.id, "amostra-%")).returning({ id: scholarships.id })).length;
    }
    for (const s of items) {
      const row = {
        id: s.id, title: s.title, institution: s.institution, country: s.country, level: s.level,
        fundingType: s.fundingType, funding: s.funding, deadline: s.deadline, deadlineTimezone: s.deadlineTimezone ?? null,
        summary: s.summary, requirements: s.requirements, requiredDocuments: s.requiredDocuments,
        applicationProcess: s.applicationProcess ?? null, eligibleCountries: s.eligibleCountries ?? null, sourceUrl: s.sourceUrl ?? null,
        verificationStatus: s.verification.status, verifiedAt: s.verification.verifiedAt ?? null
      };
      await tx.insert(scholarships).values(row).onConflictDoUpdate({ target: scholarships.id, set: { ...row, updatedAt: sql`now()` } });
      const criteria = { acceptedLevels: s.criteria?.acceptedLevels ?? [], needs: s.criteria?.needs ?? [] };
      await tx.insert(eligibilityCriteria).values({ scholarshipId: s.id, ...criteria })
        .onConflictDoUpdate({ target: eligibilityCriteria.scholarshipId, set: criteria });
    }
    return { imported: items.length, removed };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.loadEnvFile(new URL("../../.env", import.meta.url));
  } catch {
    // sem .env
  }
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Uso: npm run scholarships:import -- caminho/bolsas.json [--dry-run] [--remove-demo]");
    process.exit(1);
  }
  const result = validateScholarships(JSON.parse(await readFile(file, "utf8")));
  if (!result.ok) {
    console.error(`Nada foi gravado. ${result.errors.length} problema(s):\n- ${result.errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log(`${result.items.length} bolsa(s) válidas.`);
  if (args.includes("--dry-run")) {
    console.log("--dry-run: nada foi gravado.");
    process.exit(0);
  }
  const config = loadConfig();
  const { db, sql: connection } = createDb(config.DATABASE_URL, { ssl: config.DATABASE_SSL === "require", prepare: config.DATABASE_PREPARE === "1", max: 1 });
  const { imported, removed } = await importScholarships(db, result.items, { removeDemo: args.includes("--remove-demo") });
  await connection.end();
  console.log(`Importadas/atualizadas: ${imported}.${removed ? ` Bolsas de demonstração removidas: ${removed}.` : ""}`);
  if (config.SEED_DEMO_DATA === "1") console.log("Lembrete: SEED_DEMO_DATA=1 recria as bolsas fictícias ao reiniciar. Mude para 0.");
}
